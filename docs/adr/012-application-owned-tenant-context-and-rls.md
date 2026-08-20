# ADR 012: Application-Owned Tenant Context and PostgreSQL RLS

## Status

Accepted

## Context

Living Sites uses Better Auth and Netlify Database through trusted server-side
application code. Netlify Database does not provide Supabase-specific helpers
such as `auth.uid()`, and tenant isolation cannot rely on an organization ID
supplied by a browser request. Application authorization already validates
permissions, but architecture rule 4 also requires database-layer isolation.

The same PostgreSQL connection pool serves tenant requests, public rendering,
Platform Super Admin operations, and internal workers. The database therefore
needs explicit, transaction-scoped context for each workload.

## Decision

1. The Infrastructure layer owns a `TenantContextRunner`. Every protected
   operation executes in a database transaction and sets transaction-local
   PostgreSQL settings for context mode, authenticated user, Organization, and
   optional Website scope.
2. Tenant mode starts unauthorized. Before protected repositories run, the
   Infrastructure layer verifies an active membership for the authenticated
   platform user and requested scope. Only then is the transaction marked as
   an authorized tenant context.
3. Platform Super Admin authority is derived from the
   `platform_super_admins` table for the authenticated user. Callers cannot
   grant themselves Platform Super Admin access with a boolean or tenant ID.
4. RLS is enabled and forced for tenant-owned tables. Policies require the
   validated transaction context and derive Page and Section access through
   the owning Website where necessary.
5. Public mode is read-only and exposes only published Websites, published
   Pages, and the current published PageSnapshots. A published snapshot never
   bypasses the Website publication gate.
6. Internal mode is reserved for trusted composition-root entry points such
   as migrations, reconciliation, and outbox processing. It is not exposed to
   browser-controlled transport input.
7. `AsyncLocalStorage` carries the active Drizzle transaction through existing
   repository adapters so mutations and outbox writes retain one transaction
   and one RLS context.
8. Application authorization and repository ownership predicates remain
   mandatory. RLS is defense-in-depth, not a replacement for use-case policy
   checks.

## Protected Tables

- `organizations`
- `memberships`
- `websites`
- `pages`
- `page_sections`
- `page_snapshots`
- `application_outbox`

## Platform-Global Tables

Plans, features, entitlements, Better Auth internal tables, platform users,
Platform Super Admin records, and identity linkage tables remain explicitly
platform-global. Their access continues through trusted server-side adapters
and application authorization appropriate to each capability.

## Consequences

- Missing or invalid tenant context fails closed on protected tables.
- Organization and Website scope are verified from authenticated server
  context before RLS permits tenant access.
- Platform Super Admin and internal-worker access remain explicit and
  separately testable.
- Public resolution is protected at both the application resolver and database
  policy layers.
- Repository operations that need protected tables must execute through an
  approved tenant, directory, public, or internal composition entry point.

## Supersedes

This ADR supersedes ADR 009 now that authentication and tenant context exist.
