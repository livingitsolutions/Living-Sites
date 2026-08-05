/*
# Create application_outbox table (transactional outbox)

1. Purpose
   Durable storage for domain events published by use cases. Events are
   inserted in the same database transaction as the aggregate mutation,
   guaranteeing atomic persistence: either both the aggregate and the
   outbox record commit, or neither does. A separate outbox processor
   claims pending events, dispatches to registered handlers, and marks
   them processed (or failed after bounded retries).

2. New Table
   - `application_outbox`
     - `id` text PRIMARY KEY — stable event ID (UUID-based)
     - `event_type` text NOT NULL — e.g. "organization.created"
     - `aggregate_type` text NOT NULL — e.g. "organization"
     - `aggregate_id` text NOT NULL — the aggregate's ID
     - `organization_id` text — nullable; set when known
     - `website_id` text — nullable; set when known
     - `payload` jsonb NOT NULL — serialized event payload (no secrets)
     - `occurred_at` timestamptz NOT NULL — domain time of the event
     - `created_at` timestamptz NOT NULL DEFAULT now() — insertion time
     - `status` text NOT NULL DEFAULT 'pending' — pending|processing|processed|failed
     - `attempt_count` integer NOT NULL DEFAULT 0
     - `available_at` timestamptz NOT NULL DEFAULT now() — when the event becomes eligible for processing
     - `processed_at` timestamptz — set when status becomes processed
     - `last_error` text — last dispatch/processing error message
     - `idempotency_key` text NOT NULL — stable dedup key
     - `schema_version` text NOT NULL DEFAULT '1.0.0' — event payload schema version

3. Indexes
   - `application_outbox_pending_idx` — partial index on status=pending for polling
   - `application_outbox_aggregate_idx` — on (aggregate_type, aggregate_id) for lookup
   - `application_outbox_idempotency_key_idx` — unique on idempotency_key for dedup
   - `application_outbox_organization_idx` — on organization_id for per-org queries
   - `application_outbox_website_idx` — on website_id for per-website queries

4. Security
   - RLS enabled. No anon/authenticated policies — the outbox is internal
     infrastructure accessed server-side only. RLS defaults to deny.

5. Notes
   - Additive and forward-only. No destructive operations.
   - The partial pending index keeps polling efficient as processed events
     accumulate.
   - `available_at` supports bounded backoff: on failure, the processor
     sets a future `available_at` so the event is not immediately re-claimed.
   - `idempotency_key` uniqueness prevents duplicate events from retries.
*/
CREATE TABLE IF NOT EXISTS "application_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "event_type" text NOT NULL,
  "aggregate_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "organization_id" text,
  "website_id" text,
  "payload" jsonb NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  "processed_at" timestamp with time zone,
  "last_error" text,
  "idempotency_key" text NOT NULL,
  "schema_version" text NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS "application_outbox_pending_idx"
  ON "application_outbox" ("available_at")
  WHERE "status" = 'pending';

CREATE INDEX IF NOT EXISTS "application_outbox_aggregate_idx"
  ON "application_outbox" ("aggregate_type", "aggregate_id");

CREATE UNIQUE INDEX IF NOT EXISTS "application_outbox_idempotency_key_idx"
  ON "application_outbox" ("idempotency_key");

CREATE INDEX IF NOT EXISTS "application_outbox_organization_idx"
  ON "application_outbox" ("organization_id")
  WHERE "organization_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "application_outbox_website_idx"
  ON "application_outbox" ("website_id")
  WHERE "website_id" IS NOT NULL;

ALTER TABLE "application_outbox" ENABLE ROW LEVEL SECURITY;
