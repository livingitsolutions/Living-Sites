# ADR 011 — Sole-Owner Strong Consistency Architecture

> **Status:** Accepted

## Context

In the Living Sites platform, an Organization must always retain at least one active Owner (`ORGANIZATION_OWNER`). An organization without an active owner becomes permanently orphaned and unmanageable, requiring platform-admin emergency intervention.

Mutations that demote an owner (changing their role to Editor, Admin, or Viewer) or remove an owner (archiving or deleting their membership) must be serialized in a way that prevents race conditions. Consider two concurrent requests:

1. Request A tries to remove Owner 1 of an organization with 2 owners.
2. Request B simultaneously tries to remove Owner 2 of the same organization.

Under naive optimistic concurrency or standard read-committed isolation, both transactions might independently read that 2 owners exist, conclude that 1 owner remains, and both proceed to archive their respective memberships — leaving 0 active owners.

Forces:
- **Zero-owner state is prohibited.** The invariant must be enforced with strong consistency.
- **Database compatibility.** Must be fully compatible with Postgres and Netlify Database branching without introducing external distributed locking dependencies.
- **Minimal lock contention.** The lock must be isolated strictly to the target organization and held only for the brief duration of the transaction.
- **Optimistic concurrency coexistence.** Existing aggregate version checks on the membership row must continue to function normally.

## Decision

We adopt **Organization row-level locking (`SELECT id FROM organizations WHERE id = $orgId FOR UPDATE`) inside an atomic database transaction** for all owner-modifying operations (`changeRole` and `archive` when the target is an active owner).

### Concurrency Mechanism

1. When `changeRole` (demoting an owner) or `archive` (removing an owner) is invoked, the repository checks if the target membership is currently an active Owner.
2. If it is an active Owner, the repository executes the mutation within a database transaction:
   - It executes `SELECT id FROM organizations WHERE id = $orgId FOR UPDATE`. This acquires an exclusive row-level lock on the organization row in Postgres, serializing all concurrent owner mutations for that specific organization.
   - It queries the current active owners for the organization within the same transaction.
   - If `activeOwners.length <= 1` (and the target membership is one of the remaining active owners), the transaction immediately aborts and returns a typed error (`cannot_demote_sole_owner` / `cannot_remove_sole_owner`).
   - If more than 1 active owner exists, the transaction performs the update on the membership row with the optimistic concurrency check (`WHERE id = $id AND version = $expectedVersion`), increments the version, and commits.
3. If the membership is not currently an owner (e.g. changing an Editor to Admin or removing a Viewer), the standard optimistic concurrency update executes without acquiring the organization row lock, avoiding unnecessary lock contention.

4. Membership persistence does not expose a generic `save(aggregate)` mutation. Role changes and archival must use the invariant-aware `changeRole` and `archive` operations, preventing callers from bypassing the owner lock and owner-count check.

### Consequences

- **Positive:** Guarantees strong consistency. Two concurrent removal/demotion requests are serialized on the organization row lock; the first succeeds, and the second reads the updated state (1 owner remaining) and is safely rejected.
- **Positive:** Uses platform-native Postgres row-level locks without external dependencies (no Redis or external lock managers).
- **Positive:** Automatically released on transaction commit or rollback.
- **Positive:** Scoped strictly per-organization; operations across different organizations do not block each other.

## Implementation Verification

- `DrizzleMembershipRepository` acquires the organization row with `SELECT ... FOR UPDATE` inside the same transaction that counts active owners and updates the membership.
- The former process-local mutex is removed and is not part of correctness.
- Race tests invoke two independent repository instances concurrently and verify one active owner remains after competing removals and demotions.
