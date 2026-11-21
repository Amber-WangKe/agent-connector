import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONNECTOR_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_AGENT_ID = /^[a-z][a-z0-9_-]{0,31}$/;
const ENV_TOKEN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

function expandEnv(value, label, env) {
  if (typeof value !== "string") return value;
  return value.replace(ENV_TOKEN, (_, name) => {
    const resolved = env[name];
    if (resolved === undefined) {
      throw new Error(`${label} references missing environment variable ${name}`);
    }
    return resolved;
  });
}

function expandDeep(value, label, env) {
  if (typeof value === "string") return expandEnv(value, label, env);
  if (Array.isArray(value)) return value.map((item, index) => expandDeep(item, `${label}[${index}]`, env));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, expandDeep(item, `${label}.${key}`, env)]),
    );
  }
  return value;
}

function stringArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function positiveInteger(value, fallback, min, max) {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isLoopbackHost(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function validateAgent(rawAgent, security) {
  if (!rawAgent || typeof rawAgent !== "object") throw new Error("Each agent must be an object");
  const id = String(rawAgent.id || "").trim();
  if (!SAFE_AGENT_ID.test(id)) {
    throw new Error(`Agent id must match ${SAFE_AGENT_ID}: ${id || "(missing)"}`);
  }
  if (rawAgent.readOnly !== true) {
    throw new Error(`Agent ${id} must set readOnly=true. Write-capable agents are not supported in this MVP.`);
  }

  const label = String(rawAgent.label || id);
  const timeoutMs = positiveInteger(rawAgent.timeoutMs, 600000, 5000, 3600000);
  const type = String(rawAgent.type || "");

  if (type === "cli") {
    if (typeof rawAgent.executable !== "string" || !rawAgent.executable.trim()) {
      throw new Error(`CLI agent ${id} requires executable`);
    }
    if (!Array.isArray(rawAgent.args)) throw new Error(`CLI agent ${id} requires an args array`);
    return {
      ...rawAgent,
      id,
      label,
      type,
      timeoutMs,
      args: rawAgent.args.map(String),
      cwd: path.resolve(CONNECTOR_ROOT, rawAgent.cwd || process.cwd()),
      stdin: rawAgent.stdin === undefined ? "{prompt}" : rawAgent.stdin,
      env: rawAgent.env && typeof rawAgent.env === "object" ? rawAgent.env : {},
      resultMode: rawAgent.resultMode || "auto",
    };
  }

  if (type === "http") {
    let endpoint;
    try {
      endpoint = new URL(String(rawAgent.endpoint || ""));
    } catch {
      throw new Error(`HTTP agent ${id} has an invalid endpoint`);
    }
    if (!["http:", "https:"].includes(endpoint.protocol)) {
      throw new Error(`HTTP agent ${id} must use http or https`);
    }
    if (!isLoopbackHost(endpoint.hostname) && !security.allowRemoteAgentEndpoints) {
      throw new Error(`HTTP agent ${id} is not loopback. Set security.allowRemoteAgentEndpoints=true only for a trusted network.`);
    }
    const method = String(rawAgent.method || "POST").toUpperCase();
    if (!["POST", "PUT", "PATCH"].includes(method)) {
      throw new Error(`HTTP agent ${id} only supports POST, PUT or PATCH`);
    }
    return {
      ...rawAgent,
      id,
      label,
      type,
      timeoutMs,
      endpoint: endpoint.toString(),
      method,
      headers: rawAgent.headers && typeof rawAgent.headers === "object" ? rawAgent.headers : {},
      body: rawAgent.body === undefined ? { prompt: "{prompt}" } : rawAgent.body,
      responsePath: rawAgent.responsePath || "",
    };
  }

  throw new Error(`Agent ${id} has unsupported type: ${type}`);
}

export function buildConfig(rawConfig, { env = process.env } = {}) {
  if (!rawConfig || typeof rawConfig !== "object") throw new Error("Config must be a JSON object");
  const expanded = expandDeep(rawConfig, "config", env);
  const securityInput = expanded.security || {};
  const security = {
    allowAllUsers: securityInput.allowAllUsers === true,
    allowedOpenIds: stringArray(securityInput.allowedOpenIds),
    allowedChatIds: stringArray(securityInput.allowedChatIds),
    maxConcurrency: positiveInteger(securityInput.maxConcurrency, 2, 1, 8),
    maxPromptChars: positiveInteger(securityInput.maxPromptChars, 12000, 1, 20000),
    maxJobsPerUser: positiveInteger(securityInput.maxJobsPerUser, 1, 1, 4),
    allowRemoteAgentEndpoints: securityInput.allowRemoteAgentEndpoints === true,
  };

  const rawAgents = Array.isArray(expanded.agents) ? expanded.agents : [];
  if (rawAgents.length === 0) throw new Error("Config requires at least one agent");
  const agents = rawAgents.map((agent) => validateAgent(agent, security));
  const byId = new Map();
  for (const agent of agents) {
    if (byId.has(agent.id)) throw new Error(`Duplicate agent id: ${agent.id}`);
    byId.set(agent.id, agent);
  }

  const defaultAgent = String(expanded.defaultAgent || agents[0].id);
  if (!byId.has(defaultAgent)) throw new Error(`Unknown defaultAgent: ${defaultAgent}`);

  return {
    version: expanded.version || 1,
    defaultAgent,
    security,
    agents,
    byId,
  };
}

export function loadConfig(configPath = process.env.AGENT_CONNECTOR_CONFIG || "agents.json", options = {}) {
  const resolved = path.resolve(CONNECTOR_ROOT, configPath);
  let text;
  try {
    text = fs.readFileSync(resolved, "utf8");
  } catch (error) {
    throw new Error(`Cannot read config ${resolved}: ${error.message}`);
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${resolved}: ${error.message}`);
  }
  return { ...buildConfig(raw, options), configPath: resolved };
}

export function assertFeishuEnvironment(env = process.env) {
  const appId = String(env.AGENT_CONNECTOR_FEISHU_APP_ID || "").trim();
  const appSecret = String(env.AGENT_CONNECTOR_FEISHU_APP_SECRET || "").trim();
  if (!appId || appId.includes("replace_me")) throw new Error("AGENT_CONNECTOR_FEISHU_APP_ID is not configured");
  if (!appSecret || appSecret.includes("replace_me")) throw new Error("AGENT_CONNECTOR_FEISHU_APP_SECRET is not configured");
  return { appId, appSecret };
}

export { CONNECTOR_ROOT, isLoopbackHost };
