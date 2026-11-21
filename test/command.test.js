import test from "node:test";
import assert from "node:assert/strict";
import { buildConfig } from "../src/config.js";
import { normalizeText, parseCommand } from "../src/command.js";

const config = buildConfig({
  defaultAgent: "codex",
  security: { allowedOpenIds: ["ou_test"] },
  agents: [
    { id: "codex", type: "cli", executable: "node", args: ["-v"], cwd: ".", readOnly: true },
    { id: "local-http", type: "http", endpoint: "http://127.0.0.1:8787/ask", readOnly: true },
  ],
});

test("normalizes Feishu mentions", () => {
  assert.equal(normalizeText('<at user_id="ou_x">Bot</at> /ask codex hello'), "/ask codex hello");
  assert.equal(normalizeText("@_user_1 /status"), "/status");
});

test("parses explicit and shortcut commands", () => {
  assert.deepEqual(parseCommand("/ask codex inspect README", config), {
    kind: "job", agentId: "codex", prompt: "inspect README",
  });
  assert.deepEqual(parseCommand("/local-http 你好", config), {
    kind: "job", agentId: "local-http", prompt: "你好",
  });
  assert.equal(parseCommand("/agents", config).kind, "agents");
  assert.equal(parseCommand("/whoami", config).kind, "whoami");
});

test("rejects unknown agents and commands", () => {
  assert.equal(parseCommand("/shell whoami", config).kind, "unknown");
  assert.equal(parseCommand("/ask missing hello", config).kind, "unknownAgent");
});
