# Cricket Private Fantasy development guide

This file steers coding agents working in this repository. Product behavior is defined in `SPEC.md`; confirmed implemented rules are in `confirmed-rules.md`. If code and documentation disagree, identify the mismatch rather than silently choosing one.

## Product principles

- This is a private, multi-league cricket fantasy app for iOS and Android.
- A user may join some leagues and skip others. Never assume an authenticated user is active in every league.
- Scope every screen, query, rule, score and permission by `league_id`.
- Configure each league at creation. Do not hard-code IPL 2026 limits, phases, transfers, boosters or scoring values into shared logic.
- Historical results must be reproducible. Persist the rule and calculation versions used by every fixture.
- Never rewrite published scores, completed lineups or ownership without an explicit admin workflow and audit event.

## Terminology

- Primary navigation: `Ranking`, `League`, `Matches`, `Owner`, `History`, `Rules`.
- An **owner** is a participant in one league, not merely an authenticated user.
- An **owned player** belongs to an owner in that league; an **open player** has no league owner.
- **Marquee**, **unique**, and **royalty points** are separate concepts.
- `BAI` means Batting Impact; `BOI` means Bowling Impact.

## Architecture rules

- Treat the Expo client as untrusted. Enforce lineup, ownership, transfers, boosters, locks and scoring in Supabase RPCs/backend jobs as well as the UI.
- Enable RLS on every API-exposed table/view. Privileged mutations verify league-admin membership server-side.
- Add versioned files under `supabase/migrations` for schema changes; never leave production-only manual changes undocumented.
- Use effective-from-match versions. Started/completed fixtures do not adopt later rule changes automatically.
- Separate score ingestion, calculation, review and publication. Store raw source facts separately from fantasy calculations.
- Persist explainable per-player batting, bowling, fielding, bonus, royalty, deduction and multiplier breakdowns.
- Write audit events for league setup, members, rules, ownership and score publication/correction.

## Configurability requirements

The league configuration described in `SPEC.md` must support:

- auction/owned-player and all-open-player leagues;
- royalty scoring independently enabled or disabled;
- unique-player restrictions independently enabled or disabled;
- configurable marquee/unique definitions and royalty formula;
- phases, transfer periods, boosters, playing and points rules;
- league-specific owner invitations and opt-in;
- template-based league creation without copying bids, ownership, lineups, scores or usage balances.

Competition-defining configuration is locked when the league starts. Any permitted later change creates a new version with an effective fixture.

## UI rules

- Admins edit setup/rules; owners can read published rules.
- Clearly show loading, empty, offline and permission-error states.
- Use consistent cricket-team colors and distinguish owner names, player names and team badges.
- Keep Home in the standard top-left header location.
- Invalid submissions must be rejected with a specific reason, not merely warned.

## Required checks

Before committing application changes:

```sh
npm run typecheck
git diff --check
```

For database work, also add/update read-only verification SQL, review RLS/grants, test admin and owner access, and document rollout/rollback considerations.

Never commit `.env.local`, database passwords, service-role keys, signing credentials or provider secrets. `EXPO_PUBLIC_*` values are public and must not contain privileged keys.

