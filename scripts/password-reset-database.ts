import { execNetlifyCli } from "./netlify-cli";

export const PRODUCTION_DATABASE_BRANCH = "production";

type NetlifyCliExecutor = (args: readonly string[]) => string;
type PasswordResetEnvironment = Readonly<Record<string, string | undefined>>;

export interface PasswordResetDatabaseOptions {
  readonly productionSite?: string;
  readonly branch?: string;
  readonly environment?: PasswordResetEnvironment;
  readonly executeNetlifyCli?: NetlifyCliExecutor;
}

export interface PasswordResetDatabaseTarget {
  readonly branch: string;
  readonly connectionString: string;
}

function requiredConnectionString(output: string, message: string): string {
  const result = JSON.parse(output) as {
    connection_string?: string;
    connectionString?: string;
    database?: { connectionString?: string };
  };
  const connectionString = result.connection_string
    ?? result.connectionString
    ?? result.database?.connectionString;
  if (!connectionString) throw new Error(message);
  return connectionString;
}

export function resolvePasswordResetDatabase(
  options: PasswordResetDatabaseOptions,
): PasswordResetDatabaseTarget {
  const execute = options.executeNetlifyCli ?? execNetlifyCli;

  if (options.productionSite) {
    const sitesOutput = execute(["api", "listSites"]);
    const sites = JSON.parse(sitesOutput) as { id?: string; name?: string }[];
    const site = sites.find(({ id, name }) => id === options.productionSite || name === options.productionSite);
    if (!site?.id) throw new Error("The production Netlify site could not be resolved.");

    const databaseOutput = execute([
      "api",
      "getSiteDatabase",
      "--data",
      JSON.stringify({ site_id: site.id }),
    ]);
    return {
      branch: PRODUCTION_DATABASE_BRANCH,
      connectionString: requiredConnectionString(
        databaseOutput,
        "Production Netlify Database credentials are unavailable.",
      ),
    };
  }

  const environment = options.environment ?? process.env;
  const configured = environment.NETLIFY_DB_URL;
  if (configured) return { branch: options.branch ?? "staging", connectionString: configured };

  const branch = options.branch ?? "staging";
  const output = execute(["database", "status", "--branch", branch, "--show-credentials", "--json"]);
  return {
    branch,
    connectionString: requiredConnectionString(
      output,
      "Netlify Database credentials are unavailable.",
    ),
  };
}
