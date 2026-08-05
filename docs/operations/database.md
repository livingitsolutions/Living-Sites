# Database Operations

## Production Dependency Graph

```
composeProduction
  ├── SystemClock
  ├── CryptoIdGenerator
  ├── ConsoleLogger
  ├── DrizzleDB (PostgreSQL via postgres-js)
  │     ├── DrizzleOrganizationRepository
  │     ├── DrizzlePlanReader
  │     ├── DrizzleFeatureReader
  │     ├── OutboxEventPublisher
  │     ├── DrizzleOrganizationCreationPersistence (atomic create + event)
  │     └── DrizzleOutboxProcessor
  └── CreateOrganization use case
        ├── OrganizationCreationPersistence (atomic path)
        ├── PlanReader (policy evaluation)
        └── EventPublisher (fallback path)
```

## Plan and Feature Persistence

Plans and Features are platform-global reference data. They are not
organization-specific. The database stores them in three tables:

- `plans` — subscription tiers (FREE, LIFETIME)
- `features` — discrete capabilities (website limit, custom domain, etc.)
- `plan_feature_entitlements` — associates plans with features and their values

The `DrizzlePlanReader` and `DrizzleFeatureReader` adapters implement
read-only ports (`PlanReader`, `FeatureReader`). They map database rows to
domain `Plan` and `Feature` contracts, reconstruct branded IDs, and reject
malformed persisted state with `InvalidPersistenceStateError`.

## Migration vs Seeding

**Migrations** define schema (tables, columns, indexes, enums). They are
additive and forward-only. They never destroy data. They are applied via
`npm run db:migrate`.

**Seeds** populate reference data (plans, features, entitlements). They are
idempotent — rerunning does not create duplicates. They are applied via
`npm run db:seed`. Seeds must never run automatically at application startup.

## Operational Commands

### Correct Order

1. **Configure** — set `DATABASE_URL` in the environment
2. **Migrate** — `npm run db:migrate`
3. **Seed** — `npm run db:seed` (when required)
4. **Health-check** — the production composition runs health checks on startup
5. **Start application/worker** — start the application or the outbox worker

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Drizzle migrations from schema changes |
| `npm run db:migrate` | Apply all pending migrations |
| `npm run db:check` | Check for schema drift |
| `npm run db:seed` | Seed platform-global plans and features |
| `npm run outbox:process` | Run the outbox processor worker |

## Integration Test Setup

Database integration tests use `TEST_DATABASE_URL`. When set, tests apply
migrations, seed data, and run against the test database. When absent,
all database suites skip transparently with a reported skip count and reason.

```bash
TEST_DATABASE_URL=postgresql://user:pass@host:5432/testdb npm test
```
