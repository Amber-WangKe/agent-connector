import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSetupServer, verifyFeishuCredentials } from "../src/setup-server.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starry-setup-server-"));
  const configPath = path.join(root, "agents.json");
  fs.writeFileSync(configPath, JSON.stringify({
    defaultAgent: "echo",
    security: { allowedOpenIds: ["ou_test"] },
    agents: [{
      id: "echo",
      type: "cli",
      executable: process.execPath,
      args: ["-e", "process.stdin.pipe(process.stdout)"],
      cwd: root,
      stdin: "{prompt}",
      readOnly: true,
    }],
  }));
  return { root, configPath, envPath: path.join(root, ".env") };
}

test("serves a token-protected local setup page and state", async () => {
  const files = fixture();
  const setup = createSetupServer({ ...files, token: "test-token", logger: { error() {} } });
  const { url } = await setup.listen({ port: 0 });
  try {
    const page = await fetch(url + "/");
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Starry Connector/);

    const denied = await fetch(url + "/api/state");
    assert.equal(denied.status, 403);

    const state = await fetch(url + "/api/state", { headers: { "x-starry-setup-token": "test-token" } });
    assert.equal(state.status, 200);
    const data = await state.json();
    assert.equal(data.appSecretConfigured, false);
    assert.equal(data.agents[0].id, "echo");
  } finally {
    await setup.close();
  }
});

test("serves starter state before the first config has been saved", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starry-setup-fresh-"));
  const setup = createSetupServer({
    configPath: path.join(root, "agents.json"),
    envPath: path.join(root, ".env"),
    token: "fresh-token",
    logger: { error() {} },
  });
  const { url } = await setup.listen({ port: 0 });
  try {
    const response = await fetch(url + "/api/state", { headers: { "x-starry-setup-token": "fresh-token" } });
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(state.agents[0].id, "local-http");
    assert.equal(state.appSecretConfigured, false);
  } finally {
    await setup.close();
  }
});

test("tests a local CLI agent through the setup API", async () => {
  const files = fixture();
  const setup = createSetupServer({ ...files, token: "test-token", logger: { error() {} } });
  const { url } = await setup.listen({ port: 0 });
  try {
    const response = await fetch(url + "/api/test-agent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-starry-setup-token": "test-token" },
      body: JSON.stringify({
        agent: {
          id: "echo",
          type: "cli",
          executable: process.execPath,
          args: ["-e", "process.stdin.pipe(process.stdout)"],
          cwd: files.root,
          stdin: "{prompt}",
          readOnly: true,
        },
      }),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.match(data.output, /STARRY_AGENT_OK/);
  } finally {
    await setup.close();
  }
});

test("verifies Feishu credentials without returning the token or secret", async () => {
  let received;
  const result = await verifyFeishuCredentials({
    appId: "cli_test",
    appSecret: "secret_value",
    fetchImpl: async (url, options) => {
      received = JSON.parse(options.body);
      return new Response(JSON.stringify({ code: 0, tenant_access_token: "should_not_escape" }), { status: 200 });
    },
  });
  assert.deepEqual(received, { app_id: "cli_test", app_secret: "secret_value" });
  assert.deepEqual(result, { ok: true, appId: "cli_test" });
  assert.equal(JSON.stringify(result).includes("should_not_escape"), false);
});
