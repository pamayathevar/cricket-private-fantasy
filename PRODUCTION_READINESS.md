# Production readiness plan

This checklist covers a small private release on iOS and Android. A checked item requires verified evidence.

## Current position

The Expo client, Supabase authentication, league foundation, RLS, configurable rules/phases/transfers/boosters and score review/publish workflow exist. Production is **not yet approved**. Major remaining risks are automated score ingestion, full multi-league setup, tests, recovery and store delivery.

## P0 — release blockers

### Security and database

- [ ] Apply all migrations to a clean staging Supabase project and run every verification script.
- [ ] Test RLS as anonymous, active owner, other owner and league admin for every table/view/RPC.
- [ ] Enforce the approved-email/member allowlist server-side.
- [ ] Keep score-provider and service-role secrets in a backend job; never in Expo.
- [ ] Add OTP/RPC abuse controls and redact personal data/secrets from logs.
- [ ] Confirm automated backups and rehearse a restore.
- [ ] Define migration forward-fix/rollback and back up before production changes.
- [ ] Confirm no secrets exist in Git history or built application bundles.

### Integrity and scoring

- [ ] Verify all reads/writes are scoped by `league_id`.
- [ ] Test non-overlapping phases/transfer periods, rule versions and server-time locks.
- [ ] Test concurrent submissions and Unique/Marquee declaration conflicts across multiple authenticated owners.
- [ ] Make score ingestion/staging/publishing idempotent.
- [ ] Pin playing, points and calculation versions for published matches.
- [ ] Add reconciliation reports for player, owner, phase and overall totals.
- [ ] Test abandoned, postponed, rescheduled, no-result and corrected matches.
- [ ] Confirm a lawful, reliable score-data source; do not depend on brittle unauthorized scraping.
- [ ] Run ingestion in a protected backend function/job, store raw facts separately, and review unresolved player mappings.
- [ ] Block publishing if any selected player is unresolved or missing calculated points.
- [ ] Add failure alerts and a documented manual recovery workflow.

### App quality

- [ ] Extract oversized screens/business rules into testable modules.
- [ ] Unit-test scoring, transfers, boosters, markers, deductions and configurable league modes.
- [ ] Integration-test Supabase RLS/RPCs.
- [ ] End-to-end test login, league choice, lineup submit/edit/lock, history and admin publishing.
- [ ] Test physical small/large iPhones and Android phones.
- [ ] Verify loading, empty, offline, expired-session, permission and server-error states.
- [ ] Add privacy-safe crash/error monitoring.
- [ ] Verify accessibility labels, touch targets, contrast and dynamic text.

## P1 — operations and delivery

### Environments and mobile release

- [ ] Separate development, staging and production Supabase projects.
- [ ] Configure EAS development, preview and production profiles.
- [ ] Store environment-specific public configuration in EAS; configure bundle/application IDs.
- [ ] Add final icons, splash, deep links, versions and build numbers.
- [ ] Distribute signed internal builds to all nine testers.
- [ ] Define OTA update compatibility, release, rollback and emergency-disable procedures.

### Monitoring, privacy and support

- [ ] Monitor auth/RPC errors, scoring jobs, publications, crashes and database capacity.
- [ ] Provide an admin audit-log view and a user support/reporting path.
- [ ] Assign owners for database, scoring, mobile release and incidents.
- [ ] Publish privacy policy, rules/terms, deletion and retention procedures.
- [ ] Confirm fantasy-contest legal requirements before fees/prizes.
- [ ] Confirm score-data and team-brand usage rights.
- [ ] Complete Apple privacy labels and Google Play Data Safety accurately.

## P2 — product hardening

- [ ] Build the draft league wizard in `SPEC.md`.
- [ ] Add per-league invitation, opt-in and decline.
- [x] Add safe template cloning without ownership, bids, fixtures, squads or competitive history.
- [x] Add auction/owned and all-open acquisition modes; keep live auction disabled.
- [x] Implement configurable Unique-driven and Royalty-driven behavior with phase declarations and audited score adjustments.
- [ ] Complete staging regression evidence for template special-rule parity, phase transitions and royalty reconciliation.
- [ ] Re-enable live auction after concurrency, reconnect and audit tests.
- [ ] Add squad/fixture import preview, validation and dry run.
- [ ] Add admin correction tools so routine work never requires ad-hoc SQL.

## Low-cost target architecture

- Expo/React Native for iOS and Android.
- EAS Build/internal distribution first, then app stores.
- Supabase Auth/Postgres/RLS/RPCs.
- A scheduled Supabase Edge Function or small protected job for authorized score ingestion.
- GitHub source control with protected `main` when collaboration expands.
- Low-volume crash/job monitoring after privacy review.

Keep infrastructure simple for the closed group, but never place privileged credentials or authoritative scoring logic in the mobile client.

## Release gates

### Internal preview

- TypeScript/tests pass; staging migration verification passes.
- Invited users authenticate and access only allowed leagues.
- Core flows pass on physical iOS and Android.

### Production candidate

- All P0 items complete.
- First five matches independently reconciled.
- Backup/restore and scoring recovery rehearsed.
- Privacy/store metadata and signed builds ready.

### Production release

- Both league admins approve the candidate.
- Backup is confirmed; deployment records commit SHA and app version.
- Smoke test covers login, league access, lineup, Rules and published history.

## Routine release commands

```sh
npm ci
npm run check
git diff --check
```

GitHub also runs these non-database checks for every pull request and push to `main`. Supabase migrations, RLS role checks, authenticated RPC tests and score reconciliation remain staging gates and are intentionally not run against a live project from CI yet.

Then deploy/verify staging, test a preview build, tag the approved commit, back up and migrate production, release the compatible build/update, smoke-test and monitor.
