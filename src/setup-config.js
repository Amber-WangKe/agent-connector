import fs from "node:fs";
import path from "node:path";
import { buildConfig, CONNECTOR_ROOT } from "./config.js";

const APP_ID_PATTERN = /^cli_[A-Za-z0-9_-]{4,128}$/;
const SAFE_ENV_VALUE = /^[A-Za-z0-9._~!@#$%^&*+\/=-]*$/;

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
}

export function starterConfig() {
  return {
    version: 1,
    defaultAgent: "local-http",
    security: {
      allowAllUsers: false,
      allowedOpenIds: [],
      allowedChatIds: [],
      maxConcurrency: 2,
      maxPromptChars: 12000,
      maxJobsPerUser: 1,
      allowRemoteAgentEndpoints: false,
    },
    agents: [{
      id: "local-http",
      label: "Local HTTP Agent",
      type: "http",
      endpoint: "http://127.0.0.1:8787/ask",
      method: "POST",
      body: { prompt: "{prompt}", chatId: "{chatId}", userId: "{userId}", jobId: "{jobId}" },
      responsePath: "answer",
      timeoutMs: 300000,
      readOnly: true,
    }],
  };
}

export function parseEnv(text) {
  const values = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function stringList(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[\s,，;；]+/);
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

export function publicAgent(agent) {
  return {
    id: agent.id,
    label: agent.label || agent.id,
    type: agent.type,
    executable: agent.executable || "",
    endpoint: agent.endpoint || "",
    method: agent.method || "POST",
    args: Array.isArray(agent.args) ? agent.args : [],
    cwd: agent.cwd || "",
    stdin: agent.stdin ?? "{prompt}",
    responsePath: agent.responsePath || "",
    timeoutMs: agent.timeoutMs || 600000,
    readOnly: true,
    sensitiveFields: {
      env: Object.keys(agent.env || {}),
      headers: Object.keys(agent.headers || {}),
    },
  };
}

export function setupState({ configPath, envPath }) {
  const rawConfig = readJson(configPath, starterConfig());
  const config = buildConfig(rawConfig);
  const env = parseEnv(fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "");
  return {
    appId: env.AGENT_CONNECTOR_FEISHU_APP_ID || "",
    appSecretConfigured: Boolean(env.AGENT_CONNECTOR_FEISHU_APP_SECRET),
    defaultAgent: config.defaultAgent,
    security: config.security,
    agents: config.agents.map(publicAgent),
    configPath,
    envPath,
  };
}

function validatedAgents(rawAgents) {
  if (!Array.isArray(rawAgents) || rawAgents.length === 0) throw new Error("At least one agent is required");
  const config = buildConfig({
    defaultAgent: rawAgents[0]?.id,
    security: { allowAllUsers: true },
    agents: rawAgents.map((agent) => ({ ...agent, readOnly: true })),
  });
  return config.agents.map(publicAgent);
}

function mergeSensitiveFields(nextAgent, previousAgent) {
  if (!previousAgent) return nextAgent;
  return {
    ...nextAgent,
    env: previousAgent.env && typeof previousAgent.env === "object" ? previousAgent.env : {},
    headers: previousAgent.headers && typeof previousAgent.headers === "object" ? previousAgent.headers : {},
  };
}

export function normalizeSetupPayload(payload, previousRawConfig = {}) {
  const appId = String(payload.appId || "").trim();
  const appSecret = String(payload.appSecret || "").trim();
  if (appId && !APP_ID_PATTERN.test(appId)) throw new Error("App ID must start with cli_ and contain only safe characters");
  if (appSecret && (appSecret.length < 8 || appSecret.length > 512 || !SAFE_ENV_VALUE.test(appSecret))) {
    throw new Error("App Secret contains unsupported characters or has an invalid length");
  }

  const agents = validatedAgents(payload.agents);
  const oldById = new Map((previousRawConfig.agents || []).map((agent) => [agent.id, agent]));
  const mergedAgents = agents.map((agent) => mergeSensitiveFields(agent, oldById.get(agent.id)));
  const defaultAgent = String(payload.defaultAgent || mergedAgents[0].id);
  const security = {
    allowAllUsers: false,
    allowedOpenIds: stringList(payload.allowedOpenIds),
    allowedChatIds: stringList(payload.allowedChatIds),
    maxConcurrency: Number(payload.maxConcurrency || 2),
    maxPromptChars: Number(payload.maxPromptChars || 12000),
    maxJobsPerUser: Number(payload.maxJobsPerUser || 1),
    allowRemoteAgentEndpoints: payload.allowRemoteAgentEndpoints === true,
  };
  const config = {
    version: 1,
    defaultAgent,
    security,
    agents: mergedAgents,
  };
  buildConfig(config);
  return { appId, appSecret, config };
}

function atomicWrite(filePath, text) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const tempPath = filePath + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tempPath, text, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

export function saveSetup({ payload, configPath, envPath }) {
  const previousRawConfig = readJson(configPath, {});
  const previousEnv = parseEnv(fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "");
  const normalized = normalizeSetupPayload(payload, previousRawConfig);
  const appId = normalized.appId || previousEnv.AGENT_CONNECTOR_FEISHU_APP_ID || "";
  const appSecret = normalized.appSecret || previousEnv.AGENT_CONNECTOR_FEISHU_APP_SECRET || "";
  if (!appId) throw new Error("Feishu App ID is required");
  if (!appSecret) throw new Error("Feishu App Secret is required");

  const envText = [
    "# agent-connector local configuration. Never commit or share this file.",
    "AGENT_CONNECTOR_FEISHU_APP_ID=" + appId,
    "AGENT_CONNECTOR_FEISHU_APP_SECRET=" + appSecret,
    "AGENT_CONNECTOR_CONFIG=" + path.basename(configPath),
    "AGENT_CONNECTOR_DATA_DIR=./data",
    "AGENT_CONNECTOR_LOG_LEVEL=info",
    "",
  ].join("\n");
  atomicWrite(envPath, envText);
  atomicWrite(configPath, JSON.stringify(normalized.config, null, 2) + "\n");
  return setupState({ configPath, envPath });
}

export function resolveSetupPaths(root = CONNECTOR_ROOT) {
  return {
    configPath: path.resolve(root, "agents.json"),
    envPath: path.resolve(root, ".env"),
  };
}
