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

## Migration 019

Run the duplicate preflight in `../verify_migration_019.sql` before applying migration 019. It must return no duplicate rows. After applying the migration, run `unique_owner_names.sql`; both rows must report `PASS`, and the final rollback must remain in place.
