import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildConfig } from "../src/config.js";
import { createRuntime } from "../src/index.js";

test("handles a Feishu event and posts the asynchronous result", async () => {
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
  const sent = [];
  const client = {
    im: {
      message: {
        create: async ({ data }) => {
          sent.push(JSON.parse(data.content).text);
          return { code: 0 };
        },
      },
    },
  };
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "starry-runtime-"));
  const runtime = createRuntime({ config, client, dataDir, logger: { warn() {}, error() {} } });
  await runtime.onEvent({
    sender: { sender_type: "user", sender_id: { open_id: "ou_test" } },
    message: {
      chat_id: "oc_test",
      message_type: "text",
      content: JSON.stringify({ text: "<at>Bot</at> /echo hello connector" }),
    },
  });
  assert.equal(sent.length, 1);
  assert.match(sent[0], /已接收/);

  const deadline = Date.now() + 3000;
  while (sent.length < 2 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(sent.length, 2);
  assert.match(sent[1], /hello connector/);
  assert.match(sent[1], /succeeded/);
});

test("answers whoami before the allowlist so users can complete setup", async () => {
  const config = buildConfig({
    security: { allowedOpenIds: [] },
    agents: [{
      id: "echo",
      type: "cli",
      executable: process.execPath,
      args: ["-e", "process.stdin.pipe(process.stdout)"],
      cwd: ".",
      readOnly: true,
    }],
  });
  const sent = [];
  const client = {
    im: { message: { create: async ({ data }) => sent.push(JSON.parse(data.content).text) } },
  };
  const runtime = createRuntime({
    config,
    client,
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "starry-whoami-")),
    logger: { warn() {}, error() {} },
  });
  await runtime.onEvent({
    sender: { sender_type: "user", sender_id: { open_id: "ou_new_user" } },
    message: {
      chat_id: "oc_new_chat",
      message_type: "text",
      content: JSON.stringify({ text: "<at>Bot</at> /whoami" }),
    },
  });
  assert.match(sent[0], /ou_new_user/);
  assert.match(sent[0], /oc_new_chat/);
});
