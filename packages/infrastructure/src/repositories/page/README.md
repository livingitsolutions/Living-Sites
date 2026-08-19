# Page Repository Adapter

> **Status:** Implemented for Page management in Sprint 15.

## Purpose

`DrizzlePageRepository` implements focused Page read, creation, metadata
update, archive, and restore capabilities against Netlify Database.

The Page row is the aggregate persistence boundary. Section persistence is
intentionally absent until the Page Builder slice; no standalone Section
repository was introduced.

## Capabilities

- Read one Page or list a Website's Pages.
- Detect active Website-scoped slug conflicts.
- Create Page and PageCreated outbox event atomically.
- Update basic details with optimistic concurrency.
- Archive or restore with durable events atomically.

## Principles

1. The adapter implements the application-layer contracts — use cases see no
   difference.
2. Publishing and snapshot persistence remain deferred.
3. Durable lifecycle events use the existing application outbox transaction.
