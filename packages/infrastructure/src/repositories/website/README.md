# Website Repository Adapter

> **Status:** Drizzle repository and atomic publication persistence implemented.

## Purpose

The `WebsiteRepositoryAdapter` adapts the application-layer
`WebsiteRepository` interface to infrastructure providers. It adds
infrastructure lifecycle methods (initialize, health check, close) via
`DatabaseBackedAdapter`.

WebsiteSettings is a child entity of the Website aggregate and has no
independent repository port. Settings are persisted atomically with the
Website root through the `WebsiteRepository`.

## Implemented adapters

- **`WebsiteRepositoryAdapter`** — composes `WebsiteRepository` as a named
  sub-adapter with `DatabaseBackedAdapter` lifecycle methods.
- **`DrizzleWebsiteRepository`** — tenant-context-aware Website reads and
  optimistic-concurrency mutations.
- **`DrizzleWebsitePublicationRepository`** — atomically updates Website
  publication status and inserts the corresponding outbox event.

## Principles

1. The adapter implements the application-layer contract — use cases see no
   difference.
2. The adapter uses `DatabaseAdapter` for data access and `Logger` for
   operation logging.
3. WebsiteSettings rows are managed within the Website transaction by the
   adapter. The table mapper for settings is a private implementation detail
   — it is not exposed as an application-layer port.
4. Protected operations run through the composition-owned tenant context so
   forced PostgreSQL RLS remains active.
