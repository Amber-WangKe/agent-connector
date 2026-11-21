import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { buildConfig } from "../src/config.js";
import { runAgent } from "../src/agent-runner.js";

test("runs a CLI agent without a shell and passes prompt on stdin", async () => {
  const config = buildConfig({
    security: { allowedOpenIds: ["ou_test"] },
    agents: [{
      id: "echo",
      type: "cli",
      executable: process.execPath,
      args: ["-e", "process.stdin.pipe(process.stdout)"],
      cwd: ".",
      stdin: "{prompt}",
      readOnly: true,
    }],
  });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-connector-cli-"));
  const result = await runAgent(config.byId.get("echo"), {
    id: "job-test", prompt: "hello; whoami", chatId: "chat", userId: "user",
  }, { dataDir });
  assert.equal(result.text, "hello; whoami");
});

test("runs an HTTP agent against a configured loopback endpoint", async () => {
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const parsed = JSON.parse(body);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ answer: `echo:${parsed.prompt}` }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const config = buildConfig({
      security: { allowedOpenIds: ["ou_test"] },
      agents: [{
        id: "http-agent",
        type: "http",
        endpoint: `http://127.0.0.1:${address.port}/ask`,
        body: { prompt: "{prompt}" },
        responsePath: "answer",
        readOnly: true,
      }],
    });
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-connector-http-"));
    const result = await runAgent(config.byId.get("http-agent"), {
      id: "job-http", prompt: "你好", chatId: "chat", userId: "user",
    }, { dataDir });
    assert.equal(result.text, "echo:你好");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("reports a useful connection error for an unavailable HTTP agent", async () => {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  const config = buildConfig({
    security: { allowedOpenIds: ["ou_test"] },
    agents: [{
      id: "offline-http",
      type: "http",
      endpoint: `http://127.0.0.1:${address.port}/ask`,
      body: { prompt: "{prompt}" },
      readOnly: true,
      timeoutMs: 5000,
    }],
  });
  await assert.rejects(
    runAgent(config.byId.get("offline-http"), {
      id: "job-offline", prompt: "hello", chatId: "chat", userId: "user",
    }, { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "agent-connector-offline-")) }),
    /connection failed to 127\.0\.0\.1:/,
  );
});
