# Vertical Slice: Create Organization

> Architecture Version 1.0.0 — Approved and Frozen
> Corrective milestone: Sprint 9

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
3. Repository `create(candidate: OrganizationDraft)` persists it
4. Repository returns `Organization` at version 1
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

The `CreateOrganization` use case depends only on `OrganizationReader &
OrganizationCreator`. Mutation methods (`save`, `softDelete`) are on the
full `OrganizationRepository` interface but are not implemented by the
Drizzle adapter in this slice. This prevents untested production mutation
code from being included.

## Composition API

### composeProduction

Requires concrete dependencies as parameters:
- `databaseUrl`
- `planRepository` (PlanRepository)
- `eventPublisher` (EventPublisher)

Fails fast with `MissingProductionDependencyError` if any are missing.
No silent fallback to in-memory or no-op dependencies.

### composeDevelopment

Uses in-memory adapters for local development. Explicitly named development
and documented as non-production. Uses `NoopEventPublisher` by default
(explicitly selected, not silent).

### composeTest

Uses deterministic test-support adapters. `InMemoryEventPublisher` captures
events for assertion. No database, no network.

## Migration Workflow

Versioned SQL migrations replace `drizzle-kit push` as the standard workflow.

### Commands

```bash
# Generate a new migration from schema changes
npm run db:generate

# Apply migrations to the database
npm run db:migrate

# Check for schema drift
npm run db:check
```

### Migration files

```
packages/infrastructure/drizzle/migrations/
  0001_create_organizations.sql
  meta/
    _journal.json
```

Migration files are immutable after creation. The workflow is forward-only.
No hardcoded database credentials — `DATABASE_URL` is used at the
composition/CLI boundary only.

**`db:push` is prohibited for production and is not part of the standard
workflow.**

### Local, preview, test, and production execution

- **Local development:** Set `DATABASE_URL` to your local PostgreSQL, run `npm run db:migrate`
- **Preview/test:** Set `DATABASE_URL` to the preview database, run `npm run db:migrate`
- **Production:** Set `DATABASE_URL` to the production database, run `npm run db:migrate`
- **Integration tests:** Set `TEST_DATABASE_URL` to a test database, run `npm test`

## Database Integration Test Behavior

The integration test suite for `DrizzleOrganizationRepository` uses
`TEST_DATABASE_URL`:

- **When `TEST_DATABASE_URL` is absent:** all database tests are skipped
  with a visible reason. Unit and contract tests still run.
- **When `TEST_DATABASE_URL` is present:** migrations are applied to the
  test database, tests run with isolated data (cleanup after each test).

Required integration tests:
1. Migration applies successfully
2. Create persists OrganizationDraft
3. Returned aggregate has version 1
4. findById reconstructs the aggregate
5. findBySlug reconstructs the aggregate
6. Normalized slug is persisted
7. Duplicate slug maps to DuplicateKeyError
8. Raw database exceptions do not escape
9. Mapper rejects invalid persisted version
10. Mapper rejects malformed persisted state
11. No database/Drizzle row type leaks to Application

A reusable contract test suite (`runRepositoryContractTests`) runs the same
core behavior against both `InMemoryOrganizationRepository` and
`DrizzleOrganizationRepository`.

## Event Publisher Ownership

| Layer | What lives here |
|---|---|
| Application | `EventPublisher` contract (interface only) |
| test-support | `InMemoryEventPublisher`, `NoopEventPublisher` |
| Infrastructure | Production event implementation (future) |
| Composition | Wires the appropriate publisher per environment |

- `composeProduction` requires a concrete `EventPublisher` — never silent no-op
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
```
