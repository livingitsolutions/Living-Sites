# Dependency Resolution

The authentication and Netlify Database stack uses versions whose peer ranges resolve without blanket suppression:

| Package | Version |
|---------|---------|
| Better Auth | 1.7.1 |
| Next.js | 16.3.1 |
| React / React DOM | 19.2.8 |
| Drizzle ORM | 0.45.2 |
| Drizzle Kit | 0.31.10 |
| Netlify Database | 1.1.0 |
| Netlify CLI | 27.1.2 |

Better Auth 1.7.1 explicitly accepts Drizzle ORM 0.45.2 and Drizzle Kit 0.31.10. Netlify Database supplies a PostgreSQL pool in the deployed runtime, which Infrastructure adapts through Drizzle's node-postgres driver. Explicit local database-dev connection strings use the postgres-js driver.

No repository or global `legacy-peer-deps=true` setting is required. `npm ls` completes without invalid peer dependencies. Netlify CLI 27.1.2 also resolves its AJV dependency graph without the previous database-command failure.
