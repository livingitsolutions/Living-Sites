# Outbox Operations

## Transactional Outbox Pattern

The Create Organization use case atomically persists the Organization
aggregate and the `OrganizationCreated` outbox record in a single database
transaction. Either both commit or neither commits.

## Outbox Schema

The `application_outbox` table stores pending events:

| Column | Description |
|--------|-------------|
| `id` | Stable event ID (UUID) |
| `event_type` | e.g. "organization.created" |
| `aggregate_type` | e.g. "organization" |
| `aggregate_id` | The aggregate's ID |
| `organization_id` | Nullable; set when known |
| `website_id` | Nullable; set when known |
| `payload` | JSON event data (no secrets) |
| `occurred_at` | Domain time of the event |
| `created_at` | Insertion time |
| `status` | pending, processing, processed, failed |
| `attempt_count` | Number of processing attempts |
| `available_at` | When the event becomes eligible for processing |
| `processed_at` | Set when status becomes processed |
| `last_error` | Last dispatch/processing error |
| `idempotency_key` | Stable dedup key (unique) |
| `schema_version` | Event payload schema version |

## Transaction Flow

1. Use case calls `OrganizationCreationPersistence.createWithEvent()`
2. Infrastructure opens a database transaction
3. Organization row is inserted
4. Outbox row is inserted (same transaction)
5. Transaction commits (both rows) or rolls back (neither row)

## Event Delivery Guarantees

- **Atomicity**: aggregate and event persist together or not at all
- **Durability**: events survive process crashes (stored in the database)
- **Idempotency**: duplicate requests do not produce duplicate events
- **No silent discard**: events are never lost without an error

## Retry and Failure Behavior

- Failed events are scheduled for retry with exponential backoff
- Base backoff: 1 second, doubling per attempt, capped at 60 seconds
- After `maxAttempts` (default: 5), events move to `failed` status
- Failed events are retained for investigation, not deleted
- Unknown event types are retained and marked failed, not deleted

## Outbox Worker

The outbox processor is a separate operational concern:

```bash
npm run outbox:process
```

The worker:
1. Claims pending events (atomic UPDATE ... RETURNING)
2. Dispatches to registered in-process handlers
3. Marks successful events `processed`
4. Records failures and schedules retry
5. Moves to `failed` after max attempts

A successfully dispatched event with zero registered subscribers is marked
`processed` and logged — this behavior is explicit.

Concurrent processors do not process the same event simultaneously (atomic
claim via UPDATE).

## Composition Startup and Shutdown

Production composition:
- Validates required configuration (fails fast on missing `databaseUrl`)
- Runs dependency health checks
- Exposes an explicit `close()` operation for graceful shutdown
- Does NOT automatically run migrations or seeds
