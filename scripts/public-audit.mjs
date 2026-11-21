import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const textExtensions = new Set([".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml", ".txt", ".ps1", ".ts"]);
const forbiddenNames = new Set([".env", "agents.json"]);
const forbiddenPrefixes = ["data/", "dist/", "node_modules/", "coverage/", ".verify-"];

function runGit(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function normalized(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

function fail(messages) {
  console.error("Public-tree audit failed:");
  for (const message of messages) console.error("- " + message);
  process.exitCode = 1;
}

let output;
try {
  output = runGit(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
} catch (error) {
  fail(["Run this audit inside a Git worktree: " + error.message]);
  process.exit();
}

const files = [...new Set(output.split("\0").filter(Boolean).map(normalized))];
const violations = [];
for (const file of files) {
  const base = path.posix.basename(file);
  if (forbiddenNames.has(base) || forbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
    violations.push("Forbidden runtime or generated path: " + file);
  }
}

const privateValues = new Set();
const retiredBrandPattern = new RegExp("st" + "arry", "i");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^AGENT_CONNECTOR_FEISHU_APP_(?:ID|SECRET)=(.*)$/);
    const value = match?.[1]?.trim();
    if (value && value.length >= 8 && !value.includes("replace_me")) privateValues.add(value);
  }
}

const configPath = path.join(root, "agents.json");
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    for (const value of config.security?.allowedOpenIds || []) privateValues.add(String(value));
    for (const value of config.security?.allowedChatIds || []) privateValues.add(String(value));
    for (const agent of config.agents || []) {
      for (const value of [agent.cwd, agent.executable, agent.endpoint]) {
        if (typeof value === "string" && value.length >= 8) privateValues.add(value);
      }
    }
  } catch {
    violations.push("Local agents.json is invalid and cannot be audited.");
  }
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  new RegExp("D:" + "\\\\" + "st" + "arry-workspace", "i"),
  new RegExp("C:" + "\\\\" + "Users" + "\\\\" + "Administrator", "i"),
  /\bou_[a-f0-9]{32}\b/i,
  /\boc_[a-f0-9]{32}\b/i,
  /\bcli_[a-f0-9]{16,}\b/i,
];

let scanned = 0;
for (const file of files) {
  const absolute = path.join(root, file);
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  const stat = fs.statSync(absolute);
  if (stat.size > 2 * 1024 * 1024) {
    violations.push("Text file is too large to audit safely: " + file);
    continue;
  }
  const text = fs.readFileSync(absolute, "utf8");
  scanned += 1;
  if (retiredBrandPattern.test(text)) violations.push("Retired product name found in " + file);
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) violations.push("Potential credential or local path in " + file);
  }
  for (const value of privateValues) {
    if (value && text.includes(value)) violations.push("Local-only value found in " + file);
  }
}

if (violations.length > 0) {
  fail(violations);
} else {
  console.log("Public-tree audit passed: " + files.length + " files, " + scanned + " text files scanned.");
}
