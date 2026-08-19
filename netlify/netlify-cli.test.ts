import { describe, expect, it } from "vitest";
import { execNetlifyCli, netlifyCliInvocation } from "../scripts/netlify-cli";

describe("Netlify CLI launcher", () => {
  it.each(["darwin", "linux"] as const)("uses npx directly on %s", (platform) => {
    expect(netlifyCliInvocation(["--version"], platform)).toEqual({
      executable: "npx",
      args: ["netlify", "--version"],
    });
  });

  it("uses cmd.exe with escaped arguments on Windows", () => {
    const invocation = netlifyCliInvocation(
      ["command with spaces", "value&whoami"],
      "win32",
      "C:\\Windows\\System32\\cmd.exe",
    );

    expect(invocation.executable).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(invocation.args.slice(0, 3)).toEqual(["/d", "/s", "/c"]);
    expect(invocation.args[3]).toContain("command^^^ with^^^ spaces");
    expect(invocation.args[3]).toContain("value^^^&whoami");
    expect(invocation.windowsVerbatimArguments).toBe(true);
  });
});

describe.runIf(process.platform === "win32")("Netlify CLI launcher on Windows", () => {
  it("runs npx netlify --version", () => {
    expect(execNetlifyCli(["--version"])).toMatch(/netlify-cli\//);
  });

  it("runs a harmless Netlify CLI command", () => {
    expect(execNetlifyCli(["--help"])).toContain("Netlify CLI");
  });

  it("preserves arguments containing spaces", () => {
    try {
      execNetlifyCli(["command with spaces"]);
      throw new Error("Expected the harmless unknown command to exit with a usage error.");
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      expect(stderr).toContain("command with spaces is not a netlify command");
    }
  });
});
