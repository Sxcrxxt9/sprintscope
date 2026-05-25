import { spawn } from "node:child_process";

const commands = [
  ["api", "node", ["--no-warnings", "server/index.js"]],
  ["web", "vite", ["--host", "0.0.0.0"]],
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    env: { ...process.env },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
      for (const running of children) running.kill("SIGTERM");
    }
  });

  return child;
});

process.on("SIGINT", () => {
  for (const child of children) child.kill("SIGINT");
});
