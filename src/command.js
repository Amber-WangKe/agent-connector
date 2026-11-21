const MENTION_PATTERN = /<at\b[^>]*>.*?<\/at>|@_user_\d+/gis;

export function normalizeText(text) {
  return String(text || "")
    .replace(MENTION_PATTERN, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function parseCommand(rawText, config) {
  const text = normalizeText(rawText);
  const stripped = text.startsWith("/") ? text.slice(1).trim() : text;
  if (!stripped) return { kind: "help" };

  const [headRaw, ...restParts] = stripped.split(/\s+/);
  const head = headRaw.toLowerCase();
  const rest = restParts.join(" ").trim();

  if (["help", "?", "starry"].includes(head) && (!rest || head === "help" || head === "?")) {
    return { kind: "help" };
  }
  if (head === "agents") return { kind: "agents" };
  if (head === "status") return { kind: "status" };
  if (head === "whoami") return { kind: "whoami" };

  if (head === "ask") {
    const [agentId, ...promptParts] = rest.split(/\s+/);
    return jobCommand(agentId || config.defaultAgent, promptParts.join(" "), config);
  }

  if (head === "starry") {
    const [verb, ...tail] = rest.split(/\s+/);
    if (!verb || ["help", "?"].includes(verb.toLowerCase())) return { kind: "help" };
    if (verb.toLowerCase() === "agents") return { kind: "agents" };
    if (verb.toLowerCase() === "status") return { kind: "status" };
    if (verb.toLowerCase() === "whoami") return { kind: "whoami" };
    if (verb.toLowerCase() === "ask") {
      const [agentId, ...promptParts] = tail;
      return jobCommand(agentId || config.defaultAgent, promptParts.join(" "), config);
    }
    if (config.byId.has(verb)) return jobCommand(verb, tail.join(" "), config);
    return { kind: "unknown", text: verb };
  }

  if (config.byId.has(head)) return jobCommand(head, rest, config);
  return { kind: "unknown", text: head };
}

function jobCommand(agentId, prompt, config) {
  if (!agentId || !config.byId.has(agentId)) {
    return { kind: "unknownAgent", agentId: agentId || "(missing)" };
  }
  return { kind: "job", agentId, prompt: String(prompt || "").trim() };
}

export function helpText(config) {
  const ids = config.agents.map((agent) => agent.id).join(", ");
  return [
    "Starry Agent Connector",
    "",
    "/agents - list configured local agents",
    "/status - show connector status",
    "/whoami - show your open_id and current chat_id",
    "/ask <agent> <question> - run one agent",
    "/<agent> <question> - shortcut for one agent",
    "",
    `Available agents: ${ids}`,
    "All agents are read-only in this version.",
  ].join("\n");
}

export function agentsText(config) {
  return config.agents
    .map((agent) => `${agent.id} (${agent.label}) - ${agent.type}, read-only`)
    .join("\n");
}
