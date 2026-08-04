# Supabase database setup

The initial migration creates the production database foundation for IPL 2026:

- leagues and allowlisted members;
- IPL teams, players and league-specific ownership;
- fixtures and server-controlled lineup locks;
- submitted XIs with captain, vice-captain and optional BAI/BOI Impact player;
- transfer events;
- versioned playing rules and scoring rules, player points and owner match totals;
- standings and administrative audit events;
- Row Level Security for every application table.

## Apply the migration

1. Open the Supabase project.
2. Select **SQL Editor** and create a new query.
3. Copy the complete contents of `migrations/202608040001_initial_schema.sql`.
4. Click **Run** once.
5. Confirm that the result reports success before running any seed/import follow-up.
6. Run `verify.sql` as a separate query. It is read-only and should show one league, nine members, ten teams, the active playing/scoring rule versions, RLS enabled on all fourteen tables, and the installed policy count.

The migration is committed as a versioned file so the database definition stays with the application code. Do not edit a production database manually without adding a matching migration.

## Seeded records

The migration seeds IPL 2026, the ten IPL teams, the nine currently approved league members, playing rules v1, and scoring rules v1. Existing authenticated users are linked to memberships by normalized email. Future approved users are linked automatically after their first successful authentication.

## Configurable rules

`lineup_rule_sets` versions the playing rules for each league. It controls lineup size and budget, minimum roles, maximum players from one cricket team, C/VC multipliers, BAI/BOI availability and multiplier, which Impact disciplines count, whether an Impact player may also be C/VC, carry-forward behavior, post-lock lineup visibility, and the other-owner penalty.

`scoring_rule_sets.rules` contains a versioned JSON scoring definition. IPL 2026 v1 includes batting, strike-rate, wicket, milestone, economy, fielding and bonus rules. Admin changes should create a new version and activate it instead of rewriting the rule version already used to calculate published matches.

Creating an Auth account alone grants no application data access. A matching active `league_members` row is required by RLS.

## Lineup writes

Owners should submit teams only through the `submit_lineup` RPC. It validates the active membership, fixture lock, 11 unique players, minimum roles, seven-player IPL-team limit, budget, captain, vice-captain and Impact selection in one transaction.

```ts
const { data: lineupId, error } = await supabase.rpc("submit_lineup", {
  p_fixture_id: fixtureId,
  p_player_ids: playerIds,
  p_captain_player_id: captainId,
  p_vice_captain_player_id: viceCaptainId,
  p_impact_player_id: impactPlayerId ?? null,
  p_impact_type: impactType || null,
});
```

Direct owner inserts into lineup tables are intentionally blocked. Admins retain direct access for corrections, with sensitive operations expected to write an `audit_events` record.

## Remaining imports

This first migration intentionally does not invent fixture timestamps or external player IDs. The next migration should import the verified IPL 2026 fixtures in UTC and the current squad snapshot from `squadData.ts`, then activate the app's Supabase reads.

## Authentication hardening

RLS protects league data even if someone creates an unapproved Supabase Auth account. Before public release, also configure a Supabase before-user-created Auth Hook to reject emails that do not exist in `league_members`; the local allowlist in `leagueMembers.ts` is only a temporary client-side convenience.
