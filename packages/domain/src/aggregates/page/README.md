# Page Aggregates

> **Status:** Persistence and basic lifecycle implemented in Sprint 15.

## Aggregates

### Page (Root)
- **Children:** Section (child entity, loaded/saved/ordered through the root)
- **Value objects:** AuditTrail, SectionSnapshotEntry (in snapshots), SeoSnapshot (in snapshots)
- **Invariants:** belongs to one Website, unique slug within website, one homepage per website, sectionOrder matches active sections, sectionTypeId references active SectionType, props validate against schema
- **Repository:** PageRepository (includes Sections)
- **Transaction boundary:** Page row + all Section rows for that page

### PageSnapshot (Root)
- **Children:** none (SectionSnapshotEntry is a value object)
- **Invariants:** append-only, immutable, unique version per pageId, retained indefinitely
- **Repository:** PageSnapshotRepository
- **Transaction boundary:** Snapshot row (with embedded section/SEO JSON)

See `docs/aggregates.md` §7–8 for full details.

## Sprint 15 lifecycle decision

Pages are created as drafts and can be updated, archived, and restored. The
schema retains the approved published and scheduled states for compatibility,
but this slice does not expose publication commands. Publishing remains
deferred until immutable PageSnapshot and Section persistence are implemented.
