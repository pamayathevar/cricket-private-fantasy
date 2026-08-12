# No Result fixture settlement

When a fixture is abandoned or cancelled because of rain or another interruption, a league administrator settles it as **No Result** from League Admin → Scoring.

The settlement is one database transaction:

- every submitted owner scores zero and receives no match rank; the void fixture is not counted as a scored match in overall or phase standings;
- the void fixture's XI is marked `cancelled`, so it cannot carry forward;
- its charged transfers are reclassified as `abandoned_refund` and return to the allowance;
- its booster usage is removed and becomes available again;
- for each owner who submitted the void fixture, every later submitted XI whose fixture is still scheduled and before its lock time is deleted, with its transfers and boosters refunded; owners who skipped the void fixture are unaffected;
- later locked, live, completed, or published XIs are preserved;
- for each affected owner, the first surviving locked XI has its transfer charge recalculated against the latest valid XI before the No Result match; its player selection and booster remain unchanged;
- after the reset, the next unlocked fixture starts from the most recent surviving valid XI: a later locked XI when one exists, otherwise the latest valid XI before the No Result fixture.

Example: Match 4 is later declared No Result after Match 5 has already locked. Match 4's transfer and booster usage are refunded and its XI is cancelled. Match 5's XI stays locked exactly as submitted, while its active transfer records are replaced with the charge for the difference between Match 3 and Match 5. Match 6 and later unlocked submissions are reset; when resubmitted, they carry forward from the valid locked Match 5 XI.

The RPC writes a `no_result_match_settled` audit event containing refund totals, affected owners, and reset match numbers. Re-running settlement returns the recorded result without changing any newly submitted XI, so an accidental double tap is safe.

## Rollout

1. Apply `202608040059_no_result_fixture_settlement.sql` through the normal Supabase migration process.
2. Run `verify_migration_059.sql`; the first row must be all `true` and all following queries must return no rows.
3. Mark the affected fixture `abandoned` or `cancelled` through the trusted fixture-import/admin process.
4. Use **Settle No Result** in League Admin → Scoring and review the returned reset/refund totals and any locked-XI transfer recalculations.
5. Ask affected owners to refresh. Their next unlocked fixture will load from the most recent surviving valid XI: the first later locked XI when one exists, otherwise the last valid XI before the void match.

## Rollback considerations

Rolling back the function definition does not reconstruct XIs that were intentionally reset. Restore the previous `settle_abandoned_match` definition only if necessary, then use the `no_result_match_settled` audit event and backups to reconstruct any future lineups. Do not change a settled fixture back to a scored result without an explicit audited score-correction workflow.
