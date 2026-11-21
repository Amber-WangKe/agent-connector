import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  normalizeSetupPayload,
  parseEnv,
  saveSetup,
  starterConfig,
  setupState,
  stringList,
} from "../src/setup-config.js";

function tempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starry-setup-config-"));
  return { root, configPath: path.join(root, "agents.json"), envPath: path.join(root, ".env") };
}

test("parses environment files and normalizes allowlists", () => {
  assert.deepEqual(parseEnv('A=1\nB="two"\n# ignored\n'), { A: "1", B: "two" });
  assert.deepEqual(stringList("ou_a, ou_b\nou_a"), ["ou_a", "ou_b"]);
});

test("provides a starter HTTP agent when a fresh install has no config", () => {
  const { configPath, envPath } = tempPaths();
  const state = setupState({ configPath, envPath });
  assert.equal(state.agents.length, 1);
  assert.equal(state.agents[0].type, "http");
  assert.equal(state.agents[0].endpoint, starterConfig().agents[0].endpoint);
  assert.deepEqual(state.security.allowedOpenIds, []);
});

test("validates and saves setup without exposing the secret in state", () => {
  const { root, configPath, envPath } = tempPaths();
  fs.writeFileSync(configPath, JSON.stringify({
    defaultAgent: "echo",
    security: { allowedOpenIds: ["ou_test"] },
    agents: [{ id: "echo", type: "cli", executable: process.execPath, args: ["-e", "process.stdin.pipe(process.stdout)"], cwd: root, readOnly: true }],
  }));
  const payload = {
    appId: "cli_test1234",
    appSecret: "local_test_secret_123",
    allowedOpenIds: "ou_test, ou_second",
    allowedChatIds: "",
    defaultAgent: "echo",
    agents: [{ id: "echo", type: "cli", executable: process.execPath, args: ["-e", "process.stdin.pipe(process.stdout)"], cwd: root, readOnly: true }],
  };
  const state = saveSetup({ payload, configPath, envPath });
  assert.equal(state.appId, "cli_test1234");
  assert.equal(state.appSecretConfigured, true);
  assert.deepEqual(state.security.allowedOpenIds, ["ou_test", "ou_second"]);
  assert.equal(JSON.stringify(state).includes("local_test_secret_123"), false);
  assert.match(fs.readFileSync(envPath, "utf8"), /STARRY_FEISHU_APP_SECRET=local_test_secret_123/);
});

test("preserves an existing secret when the setup form leaves it blank", () => {
  const { root, configPath, envPath } = tempPaths();
  fs.writeFileSync(configPath, JSON.stringify({
    defaultAgent: "echo",
    security: { allowedOpenIds: ["ou_test"] },
    agents: [{ id: "echo", type: "cli", executable: process.execPath, args: ["-e", "process.stdin.pipe(process.stdout)"], cwd: root, readOnly: true }],
  }));
  fs.writeFileSync(envPath, "STARRY_FEISHU_APP_ID=cli_existing\nSTARRY_FEISHU_APP_SECRET=existing_secret\n");
  const state = saveSetup({
    configPath,
    envPath,
    payload: {
      appId: "",
      appSecret: "",
      allowedOpenIds: ["ou_test"],
      agents: [{ id: "echo", type: "cli", executable: process.execPath, args: ["-e", "process.stdin.pipe(process.stdout)"], cwd: root, readOnly: true }],
    },
  });
  assert.equal(state.appId, "cli_existing");
  assert.equal(state.appSecretConfigured, true);
  assert.match(fs.readFileSync(envPath, "utf8"), /existing_secret/);
});

test("rejects unsafe identifiers", () => {
  assert.throws(() => normalizeSetupPayload({
    appId: "not-a-feishu-id",
    appSecret: "valid_secret_123",
    allowedOpenIds: ["ou_test"],
    agents: [{ id: "echo", type: "cli", executable: "echo", args: [], readOnly: true }],
  }), /App ID/);
});

test("allows an empty allowlist for whoami-only bootstrap", () => {
  const normalized = normalizeSetupPayload({
    appId: "cli_valid123",
    appSecret: "valid_secret_123",
    allowedOpenIds: [],
    agents: [{ id: "echo", type: "cli", executable: "echo", args: [], readOnly: true }],
  });
  assert.deepEqual(normalized.config.security.allowedOpenIds, []);
  assert.equal(normalized.config.security.allowAllUsers, false);
});
