# Specification implementation audit

Audit date: 2026-08-05. This compares `SPEC.md` with commit `da1ad2e` plus the uncommitted documentation work.

## Summary

| Area | Status | Main gap |
|---|---|---|
| Authentication | Partial | Auth works; server-side invitation lifecycle and allowlist hook need completion |
| Multi-league data scoping | Partial | Core tables use `league_id`; Home/configuration still has IPL-oriented client assumptions |
| Owner opt-in per league | Partial | Migration and mobile invitation/admin activation flows exist; multi-account and RLS testing remains |
| Playing/scoring versions | Implemented | Needs automated integration tests and cleaner admin UX |
| Configurable phases/transfers/boosters | Implemented | Needs draft-league wizard and cross-configuration tests |
| Auction ownership | Partial/deferred | Imported ownership exists; production realtime auction is disabled |
| All-open leagues | Missing | Submission/scoring logic assumes ownership and borrowed-player concepts |
| Unique-player restrictions | Missing | No classification, scope, conflict lock or concurrency enforcement |
| Marquee/royalty points | Missing | Formula needs business confirmation; no persisted breakdown category |
| League templates | Missing | No safe configuration snapshot/clone workflow |
| Score pipeline | Partial | Staging/review/publish exists; ingestion and reconciliation remain manual |
| Production operations | Missing | Staging, automated tests, monitoring, backup rehearsal and store builds remain |

## Important implementation risks

1. `cricket_teams` and `players` are global and readable by any active league member. This is acceptable only for shared catalog data; league eligibility must always use `league_players`.
2. Active membership is embedded in helper functions. Invitation discovery and accepted/declined states require separate self-access policies without weakening active league data.
3. Ownership adjustment is included in final owner scoring. All-open leagues must explicitly bypass it server-side.
4. Several historical migrations replace whole RPC definitions. New changes should add later migrations and verification rather than modifying historical files.
5. The client is concentrated in large files. Configuration-driven behavior should be moved to typed services/hooks before adding the full league wizard.
6. Score import currently relies on manual SQL datasets. This is unsuitable for routine production operation.

## Concrete client findings

- `App.tsx` still defines a fixed IPL 2026 database UUID and a static league catalog. Home must query the signed-in user's `leagues`/`league_members` rows instead.
- `leagueMembers.ts` remains for legacy prototype/test owner data, but authentication and Home membership now use Supabase. Remove the file's access-control role when remaining prototypes are retired.
- `App.tsx` retains prototype-only Dashboard, Matches and History components with fixed IPL labels, phase ranges, transfer text and seeded booster history. Production routes already use several Supabase-backed screens, but these legacy components should be removed to prevent accidental reuse.
- `SupabaseScreens.tsx` computes ownership deductions again in the client for display. Published calculation breakdown from the server should be authoritative, especially for all-open and future royalty modes.
- `SupabaseScreens.tsx` labels every roster as an auction squad. Owner UI and terminology must depend on acquisition mode.
- `App.tsx` uses a closed `BoosterCode` TypeScript union. The selection UI should render the configured booster catalog rather than requiring a new app build for every booster code.
- IPL team colors are appropriately presentation-specific, but league/team terminology should not assume IPL in shared validation messages.

## Recommended implementation sequence

### P0 — schema foundation

1. Add per-league format configuration and expanded membership states.
2. Add owner invitation response/admin activation RPCs with RLS and audit events.
3. Add versioned league-template snapshot and clone RPCs that exclude history/ownership.
4. Add verification and transactional smoke tests.

### P1 — enforce league modes

1. Resolve acquisition mode in lineup submission and scoring RPCs.
2. For all-open mode, eliminate owner borrowing/deductions while retaining configured transfer behavior.
3. Add player classifications and unique-selection reservations protected by database constraints/locks.
4. Confirm royalty formulas, then add versioned calculation and a separate persisted breakdown.

### P2 — product UI

1. Home invitation/opt-in states.
2. Draft league creation wizard.
3. Owner-management screen.
4. Template selection/import preview.
5. Conditional Auction/Owner UI based on acquisition mode.

### P3 — production hardening

Follow `PRODUCTION_READINESS.md`: staging, RLS tests, authorized score ingestion, reconciliation, monitoring, backups, physical-device testing and signed preview builds.

## Decisions intentionally deferred

- Exact royalty formula and recipient.
- Whether uniqueness is match-, phase- or league-scoped by default.
- Tie/conflict behavior beyond the proposed earliest-valid-submission default.
- Whether accepted invitations activate immediately or require admin approval. The initial schema design keeps `accepted` separate from `active` for admin control.
