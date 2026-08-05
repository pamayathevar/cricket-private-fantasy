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

Record the Supabase project, migration commit SHA, tester, timestamp and result for release evidence. Delete disposable cloned leagues after verification.

