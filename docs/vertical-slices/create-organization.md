# Vertical Slice: Create Organization

> Architecture Version 1.0.0 — Approved and Frozen
> Production foundation complete: Sprint 10

## Capability Purpose

Create a new Organization aggregate — the top-level tenant entity that owns
websites, members, media, and all other resources on the platform.

## OrganizationDraft Lifecycle

An `OrganizationDraft` is a valid aggregate before first persistence. It is
structurally distinct from a persisted `Organization`:

- `OrganizationDraft` has `version: DraftVersion` (branded with `__draft`, value 0)
- `Organization` has `version: AggregateVersion` (value >= 1)

The lifecycle:
1. Application factory helper resolves ID and timestamp via injected ports
2. Pure Domain factory creates `OrganizationDraft` (version 0)
3. `OrganizationCreationPersistence.createWithEvent()` persists the draft
   and writes the `OrganizationCreated` outbox record atomically
4. Returns `Organization` at version 1
5. `OrganizationDraft` and `Organization` are not interchangeable — the
   `__draft` brand on the version field prevents accidental assignment

## Domain/Application Factory Separation

### Domain (pure)

`createOrganizationDraft(input)` accepts already-resolved domain values:
- `OrganizationId`
- normalized name, slug, billing email
- optional `PlanId`
- timestamp value (`ISODateString`)

No I/O, no runtime contracts, no Platform imports. Returns `OrganizationDraft`.

### Application (bridging)

`createOrganizationDraftViaPorts(input)` receives `AppClock` and
`AppIdGenerator` (application-owned ports structurally compatible with
Platform implementations). Resolves ID and timestamp, then calls the pure
Domain factory.

Application does not import Platform. The composition root bridges Platform
implementations to Application ports.

## Repository Port Refinements

The full `OrganizationRepository` is split into focused capability ports:

- `OrganizationReader` — `findById`, `findBySlug`, `list`
- `OrganizationCreator` — `create(candidate: OrganizationDraft)`

### Plan and Feature Readers

Read-only ports for policy evaluation:

- `PlanReader` — `findById`, `findActiveById`, `listActive`
- `FeatureReader` — `findById`, `findByKey`, `listForPlan`

The full `PlanRepository` and `FeatureRepository` contracts remain for
future-facing use. The Drizzle adapters implement only the read ports needed
by CreateOrganization.

## Transactional Outbox

The production flow uses `OrganizationCreationPersistence.createWithEvent()`
to atomically persist the Organization and the `OrganizationCreated` outbox
record in a single database transaction. See
[ADR 008](../adr/008-transactional-outbox.md) for the architecture decision.

When `OrganizationCreationPersistence` is not provided (test/development),
the use case falls back to the separate create + publish flow.

## Composition API

### composeProduction

Requires `databaseUrl` configuration. Fails fast with
`MissingProductionDependencyError` if missing. No silent fallback to
in-memory or no-op dependencies.

Production wiring:
- SystemClock, CryptoIdGenerator, ConsoleLogger
- Drizzle Organization repository (via `DrizzleOrganizationRepository`)
- Drizzle Plan reader (`DrizzlePlanReader`)
- Drizzle Feature reader (`DrizzleFeatureReader`)
- `OutboxEventPublisher` (durable, database-backed)
- `DrizzleOrganizationCreationPersistence` (atomic create + event)
- `DrizzleOutboxProcessor`
- CreateOrganization policies and use case
- Health check and explicit `close()` operation

### composeDevelopment

Uses in-memory adapters for local development. Explicitly named development
and documented as non-production. Uses `NoopEventPublisher` by default
(explicitly selected, not silent).

### composeTest

Uses deterministic test-support adapters. `InMemoryEventPublisher` captures
events for assertion. No database, no network.

## Migration and Seed Workflow

Versioned SQL migrations replace `drizzle-kit push` as the standard workflow.

### Migration files

```
packages/infrastructure/drizzle/migrations/
  0001_create_organizations.sql
  0002_create_plans_features_entitlements.sql  (Sprint 10)
  0003_create_application_outbox.sql            (Sprint 10)
  meta/
    _journal.json
```

### Commands

```bash
# Generate a new migration from schema changes
npm run db:generate

# Apply migrations to the database
npm run db:migrate

# Check for schema drift
npm run db:check

# Seed platform-global plans and features
npm run db:seed

# Run the outbox processor worker
npm run outbox:process
```

### Correct operational order

1. Configure (`DATABASE_URL`)
2. Migrate (`npm run db:migrate`)
3. Seed (`npm run db:seed`)
4. Health-check (composition startup)
5. Start application/worker

Migrations run independently from application startup. Seeds run
independently from migrations. The outbox worker can be invoked
independently.

## Database Integration Test Behavior

Integration tests use `TEST_DATABASE_URL`:

- **When absent:** all database tests are skipped with a visible reason
  and reported skip count. Unit and contract tests still run.
- **When present:** migrations are applied, seeds are planted, and tests
  run against the test database with isolated data cleanup.

Integration test suites:
- `DrizzleOrganizationRepository` — Organization CRUD and mapping
- `DrizzlePlanReader` — Plan reads, active filtering, entitlement reconstruction
- `DrizzleFeatureReader` — Feature reads, plan entitlement listing
- `DrizzleOrganizationCreationPersistence` — Atomic create + outbox
- `DrizzleOutboxProcessor` — Processing, retry, failure, idempotency

## Event Publisher Ownership

| Layer | What lives here |
|---|---|
| Application | `EventPublisher` contract, `OrganizationCreationPersistence` port |
| test-support | `InMemoryEventPublisher`, `NoopEventPublisher` |
| Infrastructure | `OutboxEventPublisher`, `DrizzleOrganizationCreationPersistence` |
| Composition | Wires the appropriate publisher per environment |

- `composeProduction` uses `OutboxEventPublisher` — never silent no-op
- `composeDevelopment` explicitly selects `NoopEventPublisher` (documented)
- `composeTest` uses `InMemoryEventPublisher` for event capture

## Commands

```bash
# Build all packages
npm run build

# Typecheck all packages
npm run typecheck

# Lint
npm run lint

# Run unit and contract tests
npm test

# Run database integration tests (requires TEST_DATABASE_URL)
TEST_DATABASE_URL=postgresql://user:pass@host:port/dbname npm test

# Generate a new migration
npm run db:generate

# Apply migrations
DATABASE_URL=postgresql://user:pass@host:port/dbname npm run db:migrate

# Seed plans and features
DATABASE_URL=postgresql://user:pass@host:port/dbname npm run db:seed

# Run outbox processor
DATABASE_URL=postgresql://user:pass@host:port/dbname npm run outbox:process
```
