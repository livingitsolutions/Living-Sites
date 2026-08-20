# Website Aggregates

> **Status:** Implemented aggregate model and factory.

## Aggregates

### Website (Root)
- **Children:** WebsiteSettings (child entity, loaded/saved with root)
- **Value objects:** AuditTrail, password protection config, social defaults
- **Invariants:** belongs to one Organization, starts as draft, carries explicit lifecycle status, and uses aggregate versioning for optimistic concurrency
- **Repository:** WebsiteRepository (includes WebsiteSettings)
- **Publication:** `published` is the authoritative public gate; unpublishing preserves PageSnapshots
- **Transaction boundary:** Website mutation + durable publication event when publishing or unpublishing

See `docs/aggregates.md` §6 for full details.
