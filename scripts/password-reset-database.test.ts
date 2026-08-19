import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_DATABASE_BRANCH,
  resolvePasswordResetDatabase,
} from "./password-reset-database";

const productionConnectionString = "postgresql://operator:private@production.example.net/netlifydb";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolvePasswordResetDatabase", () => {
  it("ignores the current Git branch and local database URL for production", () => {
    const calls: readonly string[][] = [];
    const mutableCalls = calls as string[][];
    const executeNetlifyCli = vi.fn((args: readonly string[]) => {
      mutableCalls.push([...args]);
      return args.includes("listSites")
        ? JSON.stringify([{ id: "production-site-id", name: "living-cms" }])
        : JSON.stringify({ connection_string: productionConnectionString });
    });

    const target = resolvePasswordResetDatabase({
      productionSite: "living-cms",
      branch: "staging",
      environment: {
        BRANCH: "staging",
        NETLIFY_DB_URL: "postgresql://local:private@staging.example.net/netlifydb",
      },
      executeNetlifyCli,
    });

    expect(target).toEqual({
      branch: PRODUCTION_DATABASE_BRANCH,
      connectionString: productionConnectionString,
    });
    expect(calls).toEqual([
      ["api", "listSites"],
      ["api", "getSiteDatabase", "--data", JSON.stringify({ site_id: "production-site-id" })],
    ]);
  });

  it("resolves the deployed production database for living-cms", () => {
    const executeNetlifyCli = vi.fn((args: readonly string[]) => args.includes("listSites")
      ? JSON.stringify([{ id: "production-site-id", name: "living-cms" }])
      : JSON.stringify({ connection_string: productionConnectionString }));

    const target = resolvePasswordResetDatabase({
      productionSite: "living-cms",
      executeNetlifyCli,
    });

    expect(target.branch).toBe("production");
    expect(executeNetlifyCli).toHaveBeenLastCalledWith([
      "api",
      "getSiteDatabase",
      "--data",
      JSON.stringify({ site_id: "production-site-id" }),
    ]);
  });

  it("preserves the configured database path outside production mode", () => {
    const executeNetlifyCli = vi.fn();

    const target = resolvePasswordResetDatabase({
      branch: "staging",
      environment: { NETLIFY_DB_URL: "postgresql://local:private@local.example.net/netlifydb" },
      executeNetlifyCli,
    });

    expect(target).toEqual({
      branch: "staging",
      connectionString: "postgresql://local:private@local.example.net/netlifydb",
    });
    expect(executeNetlifyCli).not.toHaveBeenCalled();
  });

  it("does not print database credentials", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const executeNetlifyCli = vi.fn((args: readonly string[]) => args.includes("listSites")
      ? JSON.stringify([{ id: "production-site-id", name: "living-cms" }])
      : JSON.stringify({ connection_string: productionConnectionString }));

    resolvePasswordResetDatabase({
      productionSite: "living-cms",
      executeNetlifyCli,
    });

    expect(stdout).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });
});
