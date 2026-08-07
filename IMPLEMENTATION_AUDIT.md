# Specification implementation audit

Audit date: 2026-08-07. This reflects the implementation through commit `e4e0e10` and the verified Supabase migrations through `202608040047`.

## Summary

| Area | Status | Main gap |
|---|---|---|
| Authentication | Partial | Auth works; server-side invitation lifecycle and allowlist hook need completion |
| Multi-league data scoping | Implemented/verify | Core app flows are league-scoped; systematic query/RPC regression coverage remains |
| Owner opt-in per league | Implemented/verify | Invitation, accept/decline and activation flows exist; full multi-account RLS matrix remains |
| Playing/scoring versions | Implemented | Needs automated integration tests and cleaner admin UX |
| Configurable phases/transfers/boosters | Implemented | Needs draft-league wizard and cross-configuration tests |
| Auction ownership | Partial/deferred | Imported ownership exists; production realtime auction is disabled |
| All-open leagues | Implemented | Ownership is disabled, transfer periods remain enforced, and owner assignment is guarded server-side |
| Unique-player restrictions | Implemented/verify | Phase declarations, power restrictions, usage fees and automatic Unique labels exist |
| Marquee/royalty points | Implemented/verify | Versioned rules, minimums, owner-lineup eligibility and persisted adjustments exist |
| League templates | Implemented | Configuration cloning excludes bids, ownership, lineups, scores and usage balances |
| Score pipeline | Partial | Staging/review/publish exists; ingestion and reconciliation remain manual |
| Production operations | Missing | Staging, automated tests, monitoring, backup rehearsal and store builds remain |

## Important implementation risks

1. `cricket_teams` and `players` are global and readable by any active league member. This is acceptable only for shared catalog data; league eligibility must always use `league_players`.
2. Active membership is embedded in helper functions. Invitation discovery and accepted/declined states require separate self-access policies without weakening active league data.
3. Ownership adjustment is mode-aware: it is retained for Unique-driven leagues and bypassed for all-open and Royalty-driven leagues. Keep this covered by regression SQL whenever publication RPCs change.
4. Several historical migrations replace whole RPC definitions. New changes should add later migrations and verification rather than modifying historical files.
5. The client is concentrated in large files. Configuration-driven behavior should be moved to typed services/hooks before adding the full league wizard.
6. Score import currently relies on manual SQL datasets. This is unsuitable for routine production operation.

## Concrete client findings

- Home now queries the signed-in user's league memberships. Some legacy prototype components and constants remain in `App.tsx`; remove them so they cannot be mistaken for production paths.
- `leagueMembers.ts` remains for legacy prototype/test owner data, but authentication and Home membership now use Supabase. Remove the file's access-control role when remaining prototypes are retired.
- `App.tsx` retains prototype-only Dashboard, Matches and History components with fixed IPL labels, phase ranges, transfer text and seeded booster history. Production routes already use several Supabase-backed screens, but these legacy components should be removed to prevent accidental reuse.
- `SupabaseScreens.tsx` computes ownership deductions again in the client for display. Published calculation breakdown from the server should be authoritative, especially for all-open and future royalty modes.
- Owner navigation is hidden for all-open leagues. Continue auditing remaining copy so shared screens do not assume an auction or IPL competition.
- `App.tsx` uses a closed `BoosterCode` TypeScript union. The selection UI should render the configured booster catalog rather than requiring a new app build for every booster code.
- IPL team colors are appropriately presentation-specific, but league/team terminology should not assume IPL in shared validation messages.

## Recommended implementation sequence

### P0 — staging and regression evidence

1. Apply migrations `001`–`047` to a clean staging project in order.
2. Run every read-only verification script as admin, owner, other owner and anonymous where applicable.
3. Capture regression evidence for all-open, Unique-driven and Royalty-driven leagues.
4. Reconcile published player adjustments to owner, phase and overall totals.

### P1 — automated quality gates

1. Add executable unit tests for configurable lineup rules, transfers, boosters and marker carry-forward.
2. Add authenticated integration tests for lineup privacy, lock enforcement and sequential submission.
3. Add a CI workflow for type-check, web export, SQL lint/verification orchestration and secret scanning.
4. Test offline, expired-session, permission and server-error recovery on physical devices.

### P2 — product and operations

1. Complete the draft league creation wizard and import preview/dry run.
2. Replace routine score/import SQL with protected, idempotent admin jobs.
3. Add reconciliation and admin correction screens with audit events.
4. Split oversized client files into typed services, hooks and testable components.

### P3 — production hardening

Follow `PRODUCTION_READINESS.md`: staging, RLS tests, authorized score ingestion, reconciliation, monitoring, backups, physical-device testing and signed preview builds.

## Decisions intentionally deferred

- Authorized production score-data provider and ingestion schedule.
- Push/email lineup reminders (explicitly deferred to the final phase).
- Re-enabling live auction after concurrency and reconnect testing.
- Store distribution, monitoring vendor and incident ownership.
