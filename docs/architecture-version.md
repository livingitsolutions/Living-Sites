# Architecture Version

Architecture Version: 1.1.0
Status: Approved and Frozen
Approved: August 19, 2026

## Rule

Future architecture changes require an ADR and CTO review. No package
boundary, contract, or layer dependency may be modified without an approved
ADR. This includes moving types between packages, changing import
directions, adding new packages, or altering the aggregate catalog.

Version 1.1.0 adds ADR 012's application-owned PostgreSQL tenant context and
RLS strategy, plus the authoritative Website publication gate. The implemented
builder hierarchy is `Organization → Website → Pages → Page Builder`.
