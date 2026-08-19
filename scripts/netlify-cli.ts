import { execFileSync } from "node:child_process";

export function netlifyCliExecutable(platform: NodeJS.Platform = process.platform): "npx" | "npx.cmd" {
  return platform === "win32" ? "npx.cmd" : "npx";
}

export function execNetlifyCli(args: readonly string[]): string {
  return execFileSync(netlifyCliExecutable(), ["netlify", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
