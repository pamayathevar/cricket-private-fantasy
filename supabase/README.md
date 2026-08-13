# Supabase database setup

The initial migration creates the production database foundation for IPL 2026:

- leagues and allowlisted members;
- IPL teams, players and league-specific ownership;
- fixtures and server-controlled lineup locks;
- submitted XIs with captain, vice-captain and optional BAI/BOI Impact player;
- transfer events;
- versioned playing rules and scoring rules, player points and owner match totals;
- standings and administrative audit events;
- configurable league phases with overall and phase-wise standings;
- Row Level Security for every application table.

## Apply the migration

1. Open the Supabase project.
2. Select **SQL Editor** and create a new query.
3. Copy the complete contents of `migrations/202608040001_initial_schema.sql`.
4. Click **Run** once.
5. Confirm that the result reports success before running any seed/import follow-up.
6. Run `verify.sql` as a separate query. It is read-only and should show one league, nine members, ten teams, the active playing/scoring rule versions, RLS enabled on all fourteen tables, and the installed policy count.

The migration is committed as a versioned file so the database definition stays with the application code. Do not edit a production database manually without adding a matching migration.

To confirm migrations 001–008 without changing data, run `verify_migrations_001_008.sql`. It reports each migration as `OK` or `MISSING` and finishes with the IPL 2026 member, player, fixture, booster and phase counts. Do not rerun all historical migrations as a combined script against an existing project; apply only the migrations reported missing, in numerical order.

After applying the newer rule and lineup protections, run `verify_migrations_009_012.sql`. Every row should report `installed = true`.

After applying migration 013, run `verify_migration_013.sql`. All three result columns should be `true`.

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

After applying `202608040004_boosters.sql`, booster-enabled submissions use `submit_lineup_with_booster`. The server enforces one booster per lineup, player targeting, total and per-phase usage limits, and the confirmed multiplier combinations. A null booster removes any previously selected booster from that unlocked lineup.

Booster selections belong to one fixture-specific lineup and must never be copied by carry-forward logic. Carry forward only the XI and its ordinary player markers; every new fixture begins with no booster selected.

Apply `202608040005_optional_player_markers.sql` to allow owners to skip Captain and Vice-Captain. BAI and BOI were already nullable. The client passes null for every optional marker that the owner leaves unselected.

Apply `202608040006_configurable_league_phases.sql` to configure each league's phase names and match ranges. IPL 2026 is seeded with Phase 1 (1–35), Phase 2 (36–70), and Phase 3 · Playoffs (71–74). The migration links every fixture to its phase and creates `league_phase_standings`; `league_standings` remains the overall table. Admins can change future league phase definitions in `league_phases` before fixtures or scores are published. Overlapping active ranges are rejected.

Apply `202608040007_admin_rule_publishing.sql` before using the mobile League Admin screen. Its `publish_league_rules` RPC verifies the signed-in user is a league admin, validates headline playing rules, deactivates the previous active versions, creates new playing and points versions, and records an audit event in one transaction. Existing published match scores retain the rule-set version used for their calculation.

Apply `202608040008_admin_phase_publishing.sql` to enable the League Admin → League Phases editor. It validates names and ranges, rejects overlaps, requires every imported fixture to remain covered, updates fixture phase assignments and records an audit event transactionally.

Apply `202608040009_effective_rule_matches.sql` to schedule Playing and Points versions independently from a selected scheduled match. Team Selection resolves the newest playing-rule version whose effective match is not later than the selected fixture. Started matches retain their earlier version.

Apply `202608040010_match_specific_rule_enforcement.sql` so server-side lineup submission resolves Playing Rules from the submitted fixture's match number. It also adds `scoring_rule_set_for_fixture`, which the score processor must use to pin every calculation to the applicable Points Rules version.

Apply `202608040011_transfer_enforcement.sql` before testing production lineup submissions. The app then submits through `submit_lineup_with_transfer_enforcement`, which compares the XI with the latest earlier submission, charges only fresh non-owned additions, applies the configured transfer allowance, allows SUP-TR to waive that match's charge, replaces transfer records safely when an unlocked XI is edited, and writes an audit event. Migration 016 later upgrades these fixed stage allowances to configurable transfer periods.

Apply `202608040012_future_lineup_revalidation.sql` so a newly scheduled Playing Rules version revalidates existing submissions for scheduled fixtures at or after its effective match. Invalid XIs are changed to drafts, retain their players for editing, and store readable validation errors; started and completed matches are never changed.

Apply `202608040013_score_review_publish.sql` to enable the controlled scoring workflow. A trusted score processor or league admin stages a complete player-points array with `stage_match_player_points`; the fixture moves to `review`. An admin then calls `publish_match_scores`, which applies fixture-effective Playing Rules, optional C/VC and BAI/BOI, 3X/2UP boosters, and the greater-of-percentage-or-minimum other-owner deduction before publishing match ranks and updating overall/phase standings. Owners cannot read staged points.

Apply `202608040014_scoring_safeguards.sql` after migration 013. The admin UI publishes through the safe wrapper, which rejects incomplete lineup-player calculations. It also adds abandoned-match settlement: every submitted owner receives zero, match transfers and boosters are returned, and the action is audited.

Apply `202608040015_initial_lineup_free_transfers.sql` so a member's initial league-stage XI and initial playoff XI are transfer-free, while later fresh external additions consume the applicable balance.

Apply `202608040016_configurable_transfer_periods.sql` to replace the fixed league/playoff transfer buckets with any number of admin-configured periods. Each period defines its match range, allowance, and whether its first match is a free reset. Existing IPL 2026 limits are migrated to League stage (Matches 1–70, 105, Match 1 free) and Playoffs (Matches 71–74, 4, Match 71 free). Historical transfer events are assigned to the matching period, and team submission resolves and enforces the period containing the selected fixture.

Apply `202608040018_league_formats_membership_templates.sql` to add the multi-league configuration foundation. It adds auction/all-open format settings, independent marquee/unique/royalty configuration, per-league invitation responses and admin activation, plus versioned league-template snapshots and safe draft cloning. Cloning copies rules, phases, transfer periods and boosters but never ownership, bids, fixtures, lineups, scores or usage history. Run `verify_migration_018.sql`, then run `tests/league_configuration_constraints.sql` in staging; the test script rolls back all test data.

Before migration 019, run the first query in `verify_migration_019.sql`. It must return no rows. Resolve any duplicate owner display names explicitly, then apply `202608040019_unique_owner_names.sql`. It enforces a case-insensitive, trimmed unique owner/admin name per league and provides a readable error to the Owners UI. Run the full verification afterward; both installed values must be `true`.

## Squad and fixture import

After the initial schema, run `migrations/202608040002_import_ipl2026_squad_fixtures.sql`. It imports the 268-player Squad snapshot, auction prices, owner assignments, 76 open players and all 70 IPL 2026 league fixtures, including the 50 Phase 2 matches. Then run `migrations/202608040003_import_ipl2026_playoffs.sql` to add Qualifier 1, Eliminator, Qualifier 2 and the Final. Fixture timestamps are stored in UTC; verification displays them in `Asia/Kolkata`. Lineups lock at the scheduled start.

The import is repeatable: players, league ownership and fixtures are upserted by their natural unique keys. The first five fixtures are marked completed with scoring still pending; points must be imported and reviewed before changing `scoring_status` to `published`.

The SQL is generated from `squadData.ts` and `iplFixtures.ts`. After changing either source snapshot, regenerate it with:

```sh
node scripts/generate-supabase-import.mjs
```

Commit the regenerated migration, review its diff and apply it through the Supabase SQL Editor. Then run `verify.sql`; expected import totals are 268 players, 192 owned players, 76 open players and 74 fixtures.

## Authentication hardening

RLS protects league data even if someone creates an unapproved Supabase Auth account. Before public release, also configure a Supabase before-user-created Auth Hook to reject emails that do not exist in `league_members`; the local allowlist in `leagueMembers.ts` is only a temporary client-side convenience.
20. `202608040020_import_ipl2025_fixture_template_into_ipl2027.sql` imports the actual IPL 2025 fixture order as clean, scheduled IPL 2027 test fixtures, without copying competitive state.

## Unique, Marquee and Royalty rollout

Apply migrations 032–034 in numerical order:

1. `202608040032_special_player_rules.sql` adds typed, versioned league rules and the admin-only publishing RPC. Run `verify_migration_032.sql`.
2. `202608040033_phase_special_players.sql` adds owner phase selections, automatic carry-forward, final-phase locking and server-side C/VC/BAI/BOI/3X rejection. Run `verify_migration_033.sql`.
3. `202608040034_special_player_scoring.sql` applies other-player usage fees and rounded, zero-floor royalty during score publication and stores explainable adjustment rows. Run `verify_migration_034.sql`.

The Rules screen is intentionally deployed with these migrations. Deploying the client first will show a missing-table load error. Rule publishing requires an unlocked scheduled effective match. Existing locked and published matches are unchanged; republishing a reviewed match recalculates its adjustment rows under the rule version assigned to that fixture.

Rollback is forward-only: disable both modes through a new future-effective rule version. Do not drop rule or adjustment tables after matches have used them, because they are part of the scoring audit trail.

Apply `202608040035_special_mode_ownership_guard.sql` to require an Auction/Owned league for Unique-driven or Royalty-driven mode and prevent both modes being enabled together. Apply `202608040036_minimum_royalty.sql` to configure separate regular and Marquee minimum royalty credits. Under the confirmed defaults, zero or negative player contributions still generate 5 regular or 15 Marquee royalty points.

Apply `202608040037_phase_selection_window.sql` for the phase-opening and 24-hour deadline rules. Apply `202608040038_special_player_labels.sql` to expose the fixture-effective `UNIQUE`, `MARQUEE`, and automatic `AUTO UNIQUE` labels used consistently by Team Selection, Fixtures/points, Squad, Owner, and History. Run each matching verification file after its migration.

Apply `202608040040_normalize_template_transfer_periods.sql` to repair older saved templates whose free reset matches were omitted from transfer-period ranges. It makes every active template start at Match 1 and keeps later periods contiguous. Run `verify_migration_040.sql`; every period and the final aggregate check must report `PASS`.

Apply `202608040041_special_rules_template_support.sql` so newly saved templates snapshot the active Unique/Marquee/Royalty configuration and newly cloned leagues receive that configuration as a clean v1 rule set. The clone still receives no phase player declarations, automatic-Unique history, ownership, bids, lineups, transfers or scores. Run `verify_migration_041.sql`, then create a disposable clone and verify its rule values before deleting it.

Apply `202608040042_royalty_adjustment_minimum_audit.sql` to persist the configured regular or Marquee minimum on every royalty adjustment row. It backfills existing royalty rows and updates future score publication so History can explain whether the percentage or minimum produced the credit. Both values in `verify_migration_042.sql` must be `true`.

Apply `202608040043_royalty_requires_owner_lineup.sql` so an owning member earns Regular or Marquee royalty only when that member also submitted the same player in their own XI for that fixture. Borrowers still retain their full contribution. Existing published scores remain unchanged until an admin deliberately stages and republishes the match. Run `verify_migration_043.sql`; all three values must be `true`.

Apply `202608040044_missed_match_submission_and_free_reset.sql` so locked or started missed matches no longer block a member's next available lineup. Missing lineups earn no score. When a transfer period has `first_match_free`, the member's first actual submission in that period is free even if earlier period fixtures were missed. Earlier unlocked fixtures still enforce sequential submission. Run `verify_migration_044.sql`; all four values must be `true`.

Apply `202608040053_recalculate_future_lineup_transfers.sql` before releasing earlier-match resubmission with submitted future XIs. It preserves the future XI, recalculates the next future submission's transfer events against the revised preceding XI, audits the correction and rejects a resubmission that would make the future chain exceed its period allowance. Run `verify_migration_053.sql`; the first result must contain only `true` values and the mismatch query should return no rows after affected owners resubmit. Rollback requires restoring the submission RPC definition from migration 044 and dropping `recalculate_next_submitted_lineup_transfers`; do not remove its audit rows or rewrite locked/published history.

Apply `202608040054_reset_future_lineups_after_resubmission.sql` to supersede future-transfer recalculation. The migration is self-contained and supports databases both with and without migration 053's temporary recalculation hook. Resubmitting an earlier unlocked XI deletes every later unlocked submission for that owner, refunds those future transfer/booster records, and carries the revised XI forward for sequential resubmission. It refuses to change an earlier XI once any later submitted XI is locked. Run `verify_migration_054.sql`; all values must be `true` and the final query should return no rows. Rollback requires restoring the migration 053 hook and helper; audit rows recording resets must remain immutable.

Apply `202608040055_serialize_and_secure_lineup_submission.sql` after migration 054. It serializes each owner's submission chain before fixture rows are locked, preventing two-tab races between an earlier resubmission and a later submission. It also revokes authenticated access to the lower-level lineup and booster RPCs so all client submissions must pass through transfer enforcement. Run `verify_migration_055.sql`; all six values must be `true`. Rollback may remove the advisory lock only after submissions are otherwise serialized; never restore client execution on the lower-level RPCs.

Apply `202608040056_secure_score_publication_entrypoint.sql` after migration 055. It serializes score staging with the completeness check and makes superseded publishing helpers internal so admins cannot bypass score completeness checks, effective-match rule scheduling, configurable minimum royalties, or the current configurable transfer periods. Run `verify_migration_056.sql`; all ten values must be `true`. The app already uses the current safe entrypoints.

Apply `202608040057_return_authoritative_lineup_transfer_count.sql` after migration 056. The client submits through this wrapper and receives the exact transfer count written by the enforced submission transaction, keeping the confirmation popup aligned with History and the stored transfer balance. Run `verify_migration_057.sql`; all values must be `true` and the final query should return no rows.

Apply `202608040058_prioritize_active_special_player_rules.sql` after migration 057. It makes an applicable active special-player rule supersede older inactive future branches while retaining historical fallback before the active rule's effective match. This prevents an inactive low Auto Unique threshold from reappearing in later matches. Run `verify_migration_058.sql`; all values must be `true` and the mismatch query should return no rows.

Apply `202608040060_scope_automatic_unique_usage.sql` after migration 059 so Automatic Unique counts only a borrowing owner's locked XI appearance in a scored fixture involving that player's IPL team. The owning owner's appearances, fixtures between other IPL teams, and No Result fixtures are excluded. Labels and power-role enforcement share the same server-side counter. Run `verify_migration_060.sql`; its first query must return all `true` and the remaining queries must return no rows. This migration does not rewrite historical lineups or published scores.

Apply `202608040061_raise_automatic_unique_threshold.sql` after migration 060. It raises the default Automatic Unique threshold to 56 qualifying borrowed uses and publishes that threshold from each old-default league's next unlocked match, preserving deliberately customized thresholds and the rule versions used by locked and published matches. Run `verify_migration_061.sql`; all installation checks must be `true`, and both subsequent queries must return no rows.
