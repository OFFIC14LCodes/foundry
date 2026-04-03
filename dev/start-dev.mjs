import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const forgeProcess = spawn(process.execPath, [path.join(repoRoot, "dev/forge-server.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: false,
});

const npmCliPath = process.env.npm_execpath;

if (!npmCliPath) {
  throw new Error("npm_execpath is not available. Run this script through npm.");
}

const viteProcess = spawn(process.execPath, [npmCliPath, "run", "dev:vite"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: false,
});

const children = [forgeProcess, viteProcess];

let shuttingDown = false;

for (const child of children) {
  child.on("error", (error) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(error);
    for (const other of children) {
      if (other !== child && !other.killed) other.kill();
    }
    process.exit(1);
  });

  child.on("exit", (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const other of children) {
      if (!other.killed) other.kill();
    }
    process.exit(code ?? 0);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) child.kill();
    }
    process.exit(0);
  });
}
