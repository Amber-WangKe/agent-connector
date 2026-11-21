import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { buildConfig } from "./config.js";
import { runAgent } from "./agent-runner.js";
import { parseEnv, saveSetup, setupState } from "./setup-config.js";
import { renderSetupPage } from "./setup-page.js";

const MAX_BODY_BYTES = 256 * 1024;
const FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

function writeJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

function writeHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(html),
    "cache-control": "no-store",
    "content-security-policy": [
      "default-src 'self'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      "connect-src 'self'",
      "img-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  response.end(html);
}

function isLoopbackHostHeader(hostHeader) {
  try {
    const url = new URL("http://" + String(hostHeader || ""));
    return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("请求内容不是合法 JSON");
  }
}

function redactError(error, secrets = []) {
  let message = error instanceof Error ? error.message : String(error || "Unknown error");
  for (const secret of secrets.filter(Boolean)) message = message.split(String(secret)).join("[REDACTED]");
  return message.slice(0, 1200);
}

export async function verifyFeishuCredentials({ appId, appSecret, fetchImpl = fetch }) {
  if (!appId || !appSecret) throw new Error("请先填写 App ID 和 App Secret");
  const response = await fetchImpl(FEISHU_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== 0) {
    throw new Error("飞书鉴权失败：" + String(data.msg || ("HTTP " + response.status)));
  }
  return { ok: true, appId };
}

export async function testAgentConnection(agent) {
  const config = buildConfig({
    defaultAgent: agent.id,
    security: { allowAllUsers: true },
    agents: [{ ...agent, readOnly: true }],
  });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "starry-setup-agent-"));
  try {
    const result = await runAgent(config.byId.get(agent.id), {
      id: "setup-test-" + crypto.randomBytes(4).toString("hex"),
      prompt: "请只回复 STARRY_AGENT_OK",
      chatId: "setup",
      userId: "setup",
    }, { dataDir });
    return { ok: true, agentId: agent.id, output: String(result.text || "").slice(0, 2000) };
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

export function createSetupServer({ configPath, envPath, token = crypto.randomBytes(24).toString("hex"), logger = console }) {
  let server;

  async function route(request, response) {
    if (!isLoopbackHostHeader(request.headers.host)) {
      writeJson(response, 403, { error: "Forbidden host" });
      return;
    }
    if (request.method === "GET" && request.url === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === "GET" && request.url === "/") {
      writeHtml(response, renderSetupPage({ token }));
      return;
    }
    if (request.headers["x-starry-setup-token"] !== token) {
      writeJson(response, 403, { error: "配置会话已失效，请重新运行 npm run setup" });
      return;
    }
    if (request.method === "GET" && request.url === "/api/state") {
      writeJson(response, 200, setupState({ configPath, envPath }));
      return;
    }
    if (request.method === "POST" && request.url === "/api/save") {
      const payload = await readBody(request);
      const nextState = saveSetup({ payload, configPath, envPath });
      writeJson(response, 200, nextState);
      return;
    }
    if (request.method === "POST" && request.url === "/api/test-feishu") {
      const payload = await readBody(request);
      const previousEnv = parseEnv(fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "");
      const appId = String(payload.appId || previousEnv.STARRY_FEISHU_APP_ID || "").trim();
      const appSecret = String(payload.appSecret || previousEnv.STARRY_FEISHU_APP_SECRET || "").trim();
      try {
        writeJson(response, 200, await verifyFeishuCredentials({ appId, appSecret }));
      } catch (error) {
        writeJson(response, 400, { error: redactError(error, [appSecret]) });
      }
      return;
    }
    if (request.method === "POST" && request.url === "/api/test-agent") {
      const payload = await readBody(request);
      try {
        writeJson(response, 200, await testAgentConnection(payload.agent));
      } catch (error) {
        writeJson(response, 400, { error: redactError(error) });
      }
      return;
    }
    writeJson(response, 404, { error: "Not found" });
  }

  server = http.createServer((request, response) => {
    route(request, response).catch((error) => {
      logger.error("Setup request failed: " + redactError(error));
      if (!response.headersSent) writeJson(response, 500, { error: redactError(error) });
      else response.end();
    });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;

  return {
    server,
    token,
    async listen({ port = 43120, host = "127.0.0.1" } = {}) {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      const address = server.address();
      return { url: "http://" + host + ":" + address.port, port: address.port };
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
