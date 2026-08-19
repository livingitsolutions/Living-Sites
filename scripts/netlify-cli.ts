import { execFileSync, spawnSync } from "node:child_process";

const windowsCommandMetaCharacters = /([()\][%!^"`<>&|;, *?])/g;

function escapeWindowsCommand(command: string): string {
  return command.replace(windowsCommandMetaCharacters, "^$1");
}

function escapeWindowsArgument(argument: string): string {
  const escapedQuotes = argument.replace(/(?=(\\+?)?)\1"/g, "$1$1\\\"");
  const escapedTrailingSlashes = escapedQuotes.replace(/(?=(\\+?)?)\1$/, "$1$1");
  const quoted = `"${escapedTrailingSlashes}"`;
  const escapedOnce = quoted.replace(windowsCommandMetaCharacters, "^$1");
  return escapedOnce.replace(windowsCommandMetaCharacters, "^$1");
}

export function netlifyCliInvocation(
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  commandInterpreter: string = process.env.ComSpec ?? "cmd.exe",
): { executable: string; args: string[]; windowsVerbatimArguments?: boolean } {
  if (platform !== "win32") return { executable: "npx", args: ["netlify", ...args] };

  const command = [escapeWindowsCommand("npx"), ...["netlify", ...args].map(escapeWindowsArgument)].join(" ");
  return {
    executable: commandInterpreter,
    args: ["/d", "/s", "/c", `"${command}"`],
    windowsVerbatimArguments: true,
  };
}

export function execNetlifyCli(args: readonly string[]): string {
  const invocation = netlifyCliInvocation(args);
  if (process.platform === "win32") {
    const result = spawnSync(invocation.executable, invocation.args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const error = new Error(`Netlify CLI exited with status ${result.status ?? "unknown"}.`) as Error & {
        status: number | null;
        stdout: string;
        stderr: string;
      };
      error.status = result.status;
      error.stdout = result.stdout;
      error.stderr = result.stderr;
      throw error;
    }
    return result.stdout;
  }

  return execFileSync(invocation.executable, invocation.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
