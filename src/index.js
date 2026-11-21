import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONNECTOR_ROOT, assertFeishuEnvironment, loadConfig } from "./config.js";
import { agentsText, helpText, parseCommand } from "./command.js";
import { JobQueue } from "./jobs.js";
import { runAgent } from "./agent-runner.js";

const DATA_DIR = path.resolve(CONNECTOR_ROOT, process.env.STARRY_DATA_DIR || "data");

function parseMessageContent(message) {
  if (message?.message_type !== "text") return "";
  try {
    const content = JSON.parse(message.content || "{}");
    return String(content.text || "");
  } catch {
    return "";
  }
}

function senderOpenId(event) {
  return String(event?.sender?.sender_id?.open_id || "");
}

function isUserMessage(event) {
  const type = String(event?.sender?.sender_type || "").toLowerCase();
  return !type || type === "user";
}

function isAllowed(event, security) {
  if (security.allowAllUsers) return true;
  const openId = senderOpenId(event);
  if (!openId || !security.allowedOpenIds.includes(openId)) return false;
  if (security.allowedChatIds.length === 0) return true;
  const chatId = String(event?.message?.chat_id || "");
  return security.allowedChatIds.includes(chatId);
}

async function sendText(client, chatId, text) {
  return client.im.message.create({
    params: { receive_id_type: "chat_id" },
    data: {
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text: String(text || "").slice(0, 20000) }),
    },
  });
}

function resultMessage(job) {
  const header = `Starry/${job.agentId}\nJob: ${job.id}`;
  if (job.status === "failed") return `${header}\nStatus: failed\n\n${job.error || "Unknown error"}`;
  return `${header}\nStatus: succeeded\n\n${job.output || "(empty result)"}`;
}

export function createRuntime({ config, client, dataDir = DATA_DIR, logger = console }) {
  const queue = new JobQueue({
    maxConcurrency: config.security.maxConcurrency,
    maxJobsPerUser: config.security.maxJobsPerUser,
    execute: (job) => runAgent(config.byId.get(job.agentId), job, { dataDir }),
    onFinished: async (job) => {
      try {
        await sendText(client, job.chatId, resultMessage(job));
      } catch (error) {
        logger.error(`Failed to deliver ${job.id}: ${error.message}`);
      }
    },
  });

  async function onEvent(event) {
    if (!isUserMessage(event)) return;
    const chatId = String(event?.message?.chat_id || "");
    if (!chatId) return;

    const text = parseMessageContent(event.message);
    const command = parseCommand(text, config);
    if (command.kind === "whoami") {
      await sendText(client, chatId, `open_id: ${senderOpenId(event) || "(missing)"}\nchat_id: ${chatId}`);
      return;
    }

    if (!isAllowed(event, config.security)) {
      logger.warn(`Rejected message from open_id=${senderOpenId(event) || "(missing)"} chat_id=${chatId}`);
      await sendText(client, chatId, "你尚未在 Starry Connector 的 allowedOpenIds 中授权。\n发送 /whoami 获取 open_id，填入本机配置后重新启动。");
      return;
    }

    if (command.kind === "help") return sendText(client, chatId, helpText(config));
    if (command.kind === "agents") return sendText(client, chatId, agentsText(config));
    if (command.kind === "unknown") return sendText(client, chatId, `未知命令：${command.text}\n\n${helpText(config)}`);
    if (command.kind === "unknownAgent") {
      return sendText(client, chatId, `未知 Agent：${command.agentId}\n\n${agentsText(config)}`);
    }
    if (command.kind === "status") {
      const stats = queue.stats();
      return sendText(client, chatId, `Starry Connector: online\nAgents: ${config.agents.length}\nQueued: ${stats.queued}\nRunning: ${stats.running}\nAccess: read-only`);
    }
    if (!command.prompt) return sendText(client, chatId, `用法：/ask ${command.agentId} <问题>`);
    if (command.prompt.length > config.security.maxPromptChars) {
      return sendText(client, chatId, `问题过长，最多 ${config.security.maxPromptChars} 个字符。`);
    }

    let job;
    try {
      job = queue.submit({ agentId: command.agentId, prompt: command.prompt, chatId, userId: senderOpenId(event) });
    } catch (error) {
      return sendText(client, chatId, error.message);
    }
    return sendText(client, chatId, `已接收：${job.agentId}\nJob: ${job.id}\n只读执行中，完成后主动回传结果。`);
  }

  return { queue, onEvent };
}

async function checkMode() {
  const config = loadConfig();
  let credentialStatus = "configured";
  try {
    assertFeishuEnvironment();
  } catch (error) {
    credentialStatus = `not configured (${error.message})`;
  }
  console.log(`Config: valid (${config.configPath})`);
  console.log(`Agents: ${config.agents.map((agent) => `${agent.id}:${agent.type}`).join(", ")}`);
  console.log(`Feishu credentials: ${credentialStatus}`);
  console.log("Access: read-only");
}

async function start() {
  const config = loadConfig();
  const { appId, appSecret } = assertFeishuEnvironment();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const lark = await import("@larksuiteoapi/node-sdk");
  const client = new lark.Client({
    appId,
    appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });
  const runtime = createRuntime({ config, client });
  const dispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": runtime.onEvent,
  });
  const wsClient = new lark.WSClient({
    appId,
    appSecret,
    loggerLevel: lark.LoggerLevel.info,
  });

  console.log(`Starry Connector starting with ${config.agents.length} agent(s). Access: read-only.`);
  await wsClient.start({ eventDispatcher: dispatcher });

  const shutdown = () => {
    console.log("Starry Connector stopping.");
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  if (process.argv.includes("--check")) {
    await checkMode();
  } else {
    start().catch((error) => {
      console.error(`Starry Connector failed: ${error.message}`);
      process.exitCode = 1;
    });
  }
}
