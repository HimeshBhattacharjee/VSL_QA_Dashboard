# Sealant Shore Hardness monthly sign-off history

This change is additive and requires no blocking data migration.

- New submissions and approvals append identity snapshots to `ssh_daily_entries.signoffHistory`.
- Each event stores its server-generated `eventId`, UTC `occurredAt`, status, name, employee/user IDs, and signature snapshot.
- Existing rows remain readable through the resolver's legacy fallback (`checkedBy`/`submittedAt` and `approvedBy`/`approvedAt`).
- No live user profile lookup is used when rendering historical reports.
- A checked name entered for another person has no authoritative signature reference in the current schema, so its signature remains blank. To populate one, that person must be represented by an authenticated check event; the system does not borrow the submitting operator's signature.

No backfill is required. A later submit/re-approval naturally establishes audited events for amended legacy rows.
