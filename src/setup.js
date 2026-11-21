import { spawn } from "node:child_process";
import { resolveSetupPaths } from "./setup-config.js";
import { createSetupServer } from "./setup-server.js";

const { configPath, envPath } = resolveSetupPaths();
const setup = createSetupServer({ configPath, envPath });
const { url } = await setup.listen({ port: Number(process.env.STARRY_SETUP_PORT || 43120) });

console.log("Starry Connector setup: " + url);
console.log("Configuration stays on this computer. Close this window to stop the setup server.");

if (!process.argv.includes("--no-open")) {
  const opener = process.platform === "win32"
    ? ["explorer.exe", [url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];
  try {
    const child = spawn(opener[0], opener[1], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  } catch {
    console.log("Open this URL in your browser: " + url);
  }
}

const shutdown = async () => {
  await setup.close().catch(() => {});
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
