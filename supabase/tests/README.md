# Database test procedure

Run tests only against staging or a disposable local Supabase database.

## Migration 018

1. Apply migrations 001–018 in order to a clean database.
2. Run `../verify_migration_018.sql`; every installed value must be `true`, both new tables must have RLS, and started leagues must show a locked format.
3. Run `league_configuration_constraints.sql`; all four rows must report `PASS`. The script ends with `rollback`.
4. Authenticate as a league admin and call `invite_league_member` for an existing Auth email and a not-yet-registered email. Confirm both rows link after authentication.
5. Authenticate as each invited owner. Confirm the owner can read only their invitation/league summary, accept or decline it, and cannot read fixtures/squads/scores before activation.
6. As admin, activate only an accepted owner and confirm active league access. Verify activation of a declined invitation is rejected.
7. Save a template, then clone it with and without owner invitations.
8. Verify the clone contains format config, v1 playing/scoring rules, phases, transfer periods and boosters.
9. Verify the clone contains no `league_players`, fixtures, lineup submissions, transfer events, lineup boosters, player points, member scores or standings history.
10. Change a draft clone's format successfully, activate the league, then verify later format changes are rejected.

For the first clean clone test, create a league with slug `template-test-2026` from the IPL 2026 template with owner-email copying disabled, then run `verify_template_clone_ipl2026.sql`. All 15 rows must return `PASS`.

For the existing IPL 2027 test, run `verify_template_clone_ipl2027.sql`. It expects the separately imported 74 fixtures and 251 open players, while confirming no IPL 2026 ownership, bids, lineups, transfers or scores leaked into the new league.

Record the Supabase project, migration commit SHA, tester, timestamp and result for release evidence. Delete disposable cloned leagues after verification.

Migration 059 adds atomic No Result settlement. After applying it to staging or a disposable database, run `../verify_migration_059.sql`; its first row must be all `true` and the remaining queries must return no rows. Then stage Match 4 as abandoned with at least one charged transfer and one booster, submit and lock a different Match 5 XI, and leave a later Match 6 XI submitted but unlocked. Settle No Result as a league admin and confirm Match 4 usage is refunded, Match 6 is removed/refunded, and Match 5's players and booster are unchanged while its active transfer events equal the charge for the Match 3-to-Match 5 difference. Also include an owner who skipped Match 4 and confirm that owner's later submission and transfer records are untouched. An owner and an anonymous session must both be unable to settle the fixture.

Run `verify_lineup_integrity.sql` after lineup-related migrations and before a release. It is read-only; every row must report `PASS`. It checks duplicate authenticated owner mappings, duplicate active player names within a league, saved XI size, active-player membership, power-marker membership and 3X target membership.

Migration 045 adds a deferred invariant for future 3X submissions. Run `verify_migration_045.sql` after applying it. Historical published score records are intentionally immutable and are excluded from the release-blocking 3X integrity check.

Use `verify_automatic_unique_conversion.sql` in the disposable Royalty test league after publishing a deliberately low Automatic Unique threshold effective from an unlocked match. Seed qualifying locked uses by borrowing owners in fixtures involving the player's IPL team; owner appearances and fixtures between other teams must not advance the counter. The script verifies the `AUTO UNIQUE` label, confirms the owning owner remains power-eligible, and confirms a borrowing owner is restricted.

Migration 060 scopes Automatic Unique usage to borrowed appearances in fixtures involving the player's IPL team and makes labels and power restrictions share one counter. Apply it to staging, run `../verify_migration_060.sql`, and confirm its first row is all `true` and its remaining queries return no rows. In a disposable Royalty league, additionally lock three XIs for the same owned player: one by the owner in a team fixture, one by a borrower in a fixture between other teams, and one by a borrower in a player-team fixture. Only the third XI may increment the counter. Rollback requires restoring the function bodies from migrations 039 and 049; no historical lineup or score data is modified by migration 060.

Migration 061 raises the Automatic Unique default and active rules still using the prior default from 48 to 56 without changing locked or published history or deliberately customized thresholds. Apply it after migration 060, run `../verify_migration_061.sql`, and confirm the installation checks are all `true` and both subsequent queries return no rows. In a disposable league whose next fixture is unlocked, confirm a new rule version starts at that fixture while the preceding locked fixture still resolves its prior version. Rollback requires another forward rule version; do not reactivate an old rule across already-published matches.

## Migrations 032–034

1. Run verification files 032, 033 and 034 after applying each migration.
2. As an owner, attempt to save fewer or more than the configured phase player count; both must fail.
3. Attempt to select a player not owned by that owner; it must fail.
4. Save valid Unique and Marquee selections before the deadline, then confirm edits fail after the deadline and for the final phase.
5. Submit a lineup using a phase Unique Player as C, VC, BAI/BOI and 3X; every configured restriction must fail server-side.
6. Stage a match where another owner's player earns 100 and 0 points. In Unique mode, verify usage fees of 30 and 15, leaving contributions of 70 and -15.
7. In Royalty mode, verify the borrower retains the full final contribution and the owner receives 5% regular or 15% Marquee royalty.
8. Verify zero or negative contributions produce the configured minimum royalty—5 regular or 15 Marquee by default—and each borrowing-owner royalty is rounded before summing.
9. Verify 2UP applies after the Unique usage fee and is included in the Royalty base.
10. Confirm every published score references a special rule version and exposes adjustment breakdown rows.
11. Run `../verify_migration_038.sql`, then visually confirm fixture-effective special-player badges appear in Team Selection, Fixtures, Squad, Owner and History. Historical matches must retain their historical phase label.
12. Run `verify_special_player_runtime.sql` against the disposable Special Rules Test league. Every power-role and calculation row must report `PASS`; review the phase snapshots for Matches 1, 36 and 71.

## Migrations 040–041

1. Apply migration 040 and run `../verify_migration_040.sql`. Active template transfer periods must begin at Match 1 and have no gaps.
2. Apply migration 041 and run `../verify_migration_041.sql`. Both triggers must be installed and every active template with source special-player rules must contain a `special_player_rules` object.
3. Create a disposable league from the updated template. Confirm its active special-player rule values match the snapshot while `phase_special_players`, ownership, bids, lineups, transfer events, special-player usage and score adjustments remain empty.
4. Apply migration 042 after the royalty test publication. Run `../verify_migration_042.sql` and confirm both installed/backfill checks are `true`; regular rows must show minimum 5 and Marquee rows minimum 15 under the default rules.
5. Apply migration 043 and run `../verify_migration_043.sql`. Publish one test where the owning member selected the borrowed player and one where they did not. The first must create royalty; the second must create no royalty adjustment or owner credit.
6. Apply migration 044 and run `../verify_migration_044.sql`. Verify an unlocked missing earlier match blocks a later submission, a locked/started missed match does not, and the member's first actual submission in every transfer period records zero transfers even when it is not the period's first fixture.

## Migration 019

Run the duplicate preflight in `../verify_migration_019.sql` before applying migration 019. It must return no duplicate rows. After applying the migration, run `unique_owner_names.sql`; both rows must report `PASS`, and the final rollback must remain in place.
