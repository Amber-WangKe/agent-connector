import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;

function contextValues(job, resultFile) {
  return {
    prompt: job.prompt,
    chatId: job.chatId,
    userId: job.userId,
    jobId: job.id,
    resultFile,
  };
}

function materialize(value, values) {
  if (typeof value === "string") {
    return value.replace(/\{(prompt|chatId|userId|jobId|resultFile|cwd)\}/g, (_, key) => String(values[key] ?? ""));
  }
  if (Array.isArray(value)) return value.map((item) => materialize(item, values));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materialize(item, values)]));
  }
  return value;
}

function appendLimited(current, chunk) {
  if (current.length >= MAX_CAPTURE_BYTES) return current;
  const next = current + chunk;
  return next.length > MAX_CAPTURE_BYTES ? next.slice(0, MAX_CAPTURE_BYTES) : next;
}

function getByPath(value, dottedPath) {
  if (!dottedPath) return value;
  return dottedPath.split(".").filter(Boolean).reduce((current, key) => current?.[key], value);
}

export function redactText(text, secrets = []) {
  let value = String(text || "");
  for (const secret of secrets.filter(Boolean)) {
    value = value.split(String(secret)).join("[REDACTED]");
  }
  return value
    .replace(/(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED_KEY]")
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+\/-=]+/gi, "$1 [REDACTED]");
}

function deriveSecrets(agent) {
  const secrets = [];
  for (const [key, value] of Object.entries(agent.headers || {})) {
    if (/authorization|secret|token|key/i.test(key)) secrets.push(value);
  }
  for (const [key, value] of Object.entries(agent.env || {})) {
    if (/secret|token|key|password/i.test(key)) secrets.push(value);
  }
  return secrets;
}

async function runCli(agent, job, resultFile) {
  const values = { ...contextValues(job, resultFile), cwd: agent.cwd };
  const args = agent.args.map((arg) => materialize(arg, values));
  const env = { ...process.env, ...materialize(agent.env, values) };
  const child = spawn(agent.executable, args, {
    cwd: agent.cwd,
    env,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout = appendLimited(stdout, chunk); });
  child.stderr.on("data", (chunk) => { stderr = appendLimited(stderr, chunk); });

  const stdinTemplate = materialize(agent.stdin, values);
  if (typeof stdinTemplate === "string" && stdinTemplate.length > 0) child.stdin.end(stdinTemplate);
  else child.stdin.end();

  const timeout = setTimeout(() => child.kill("SIGTERM"), agent.timeoutMs);
  let exitCode;
  try {
    exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
  } finally {
    clearTimeout(timeout);
  }

  const secrets = deriveSecrets(agent);
  if (exitCode !== 0) {
    const detail = redactText((stderr || stdout || `exit code ${exitCode}`).trim(), secrets);
    throw new Error(`Agent ${agent.id} exited with ${exitCode}: ${detail.slice(-4000)}`);
  }

  const fileResult = fs.existsSync(resultFile) ? fs.readFileSync(resultFile, "utf8").trim() : "";
  const selected = agent.resultMode === "stdout" ? stdout : (fileResult || stdout);
  return { text: redactText(selected.trim() || "(agent returned no output)", secrets), exitCode };
}

async function runHttp(agent, job, resultFile) {
  const values = contextValues(job, resultFile);
  const headers = materialize(agent.headers, values);
  const body = JSON.stringify(materialize(agent.body, values));
  let response;
  try {
    response = await fetch(agent.endpoint, {
      method: agent.method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(agent.timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(`Agent ${agent.id} timed out after ${agent.timeoutMs}ms`);
    }
    const target = new URL(agent.endpoint);
    const reason = error?.cause?.code || error?.cause?.message || error?.message || "unknown network error";
    throw new Error(`Agent ${agent.id} connection failed to ${target.host}${target.pathname}: ${reason}`);
  }
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Agent ${agent.id} returned HTTP ${response.status}: ${raw.slice(0, 1000)}`);
  }

  let selected = raw;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Agent ${agent.id} returned invalid JSON`);
    }
    const value = getByPath(parsed, agent.responsePath);
    selected = typeof value === "string" ? value : JSON.stringify(value ?? parsed, null, 2);
  }
  return { text: redactText(selected.trim() || "(agent returned no output)", deriveSecrets(agent)) };
}

export async function runAgent(agent, job, { dataDir }) {
  const jobDir = path.join(dataDir, "jobs", job.id);
  fs.mkdirSync(jobDir, { recursive: true });
  const resultFile = path.join(jobDir, "result.txt");
  const result = agent.type === "cli"
    ? await runCli(agent, job, resultFile)
    : await runHttp(agent, job, resultFile);

  fs.writeFileSync(path.join(jobDir, "job.json"), JSON.stringify(job, null, 2), "utf8");
  if (result.text.length > 18000) result.text = `${result.text.slice(0, 18000)}\n... [truncated]`;
  return result;
}
