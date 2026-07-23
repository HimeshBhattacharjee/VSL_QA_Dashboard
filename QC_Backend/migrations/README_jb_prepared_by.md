# JB Contact Block Prepared By derivation

`Prepared By` is system-managed. The API stamps each changed, data-bearing row with
the authenticated user's name, employee/user IDs, signature reference and UTC time.
It derives the preparer from all distinct employee IDs in the selected date + FAB
line report context, preserving the fixed line/row report order. Duplicate employee
IDs are emitted once. Verification is blocked when no authenticated checker exists.

Run `python migrations/backfill_jb_contact_block_checker_identity.py` from
`QC_Backend` once before deployment. The migration does not alter approved reports
and only resolves a legacy name when it has exactly one Active user match. Records
with `preparedByBackfillStatus=needs_authenticated_resave` require an operator to
open and save the check; the unresolved values are listed in
`preparedByUnresolvedCheckerNames`.
