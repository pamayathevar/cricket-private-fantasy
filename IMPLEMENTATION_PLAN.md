# Prioritized implementation plan

## Ordered engineering backlog — 2026-08-09

Work through these in order, keeping each change independently testable:

1. **Deferred pending a measured bottleneck — list performance:** virtualize Fixtures first, followed by History, Squad and Owner lists. Avoid an invasive renderer rewrite until physical-device timings identify a screen above the three-second target.
2. **In progress — automated app tests:** 29 unit tests now cover scoring, fantasy markers, lineup lock timing, sequential submission, skipped locked matches, transfer-period resets, Super Transfer availability, submission/resubmission labels, fixture Submit/Edit/View routing, pre-lock privacy, post-lock visibility, single-match booster behavior and Unique/Auto Unique power restrictions. Next cover database integration paths.
3. **Module boundaries:** split oversized `App.tsx` and `SupabaseScreens.tsx` into screen, hook and shared-component modules without changing behavior.
4. **Player discovery:** add consistent player search alongside the existing role, ownership, availability, marquee and sorting controls.
5. **Screen-state consistency:** standardize pull-to-refresh, loading, empty, offline and permission-error treatments.
6. **Accessibility and device QA:** label interactive controls, verify touch targets, contrast, long owner/player names, keyboard behavior and Android/iOS safe areas.
7. **Dense-screen navigation:** make filters collapsible/persistent and add anchors or section navigation to the long Rules screen.
8. **Regression and release checks:** run type checking, secret checks, web export and targeted manual smoke tests after each group of fixes.

## Tomorrow's worklist

### 1. Verify today's performance change

- [ ] Open Fixtures with all 74 IPL matches and confirm the screen loads normally.
- [ ] Expand several matches and confirm Unique, Auto Unique and Marquee badges appear correctly.
- [ ] Reopen the same match and confirm it responds quickly.
- [ ] Repeat the checks in History.
- [ ] Test on Android, iPhone and web.

### 2. Fixtures and History usability

- [x] Centralize **Submit XI**, **Edit XI**, **View XI**, **View scores** and **Opens later** routing, with unit coverage. Physical-device verification remains in the deferred QA checklist.
- [ ] Verify selecting a fixture opens League with the correct match clearly selected and visible.
- [ ] Verify locked/completed fixtures show **View XI** and published fixtures show **View scores**.
- [ ] Add or improve phase, date and status grouping if the 74-match list remains difficult to scan.
- [x] Add History filters for match, phase, scoring status and owner; preserve direct fixture navigation.

### 3. Loading and reliability

- [ ] Measure load time for League, Fixtures, Squad, Owner and History on a physical phone.
- [ ] Identify screens taking longer than three seconds.
- [x] Add consistent loading indicators and retry states where content previously appeared blank. Verified across League, Fixtures, History, Squad and Owner.
- [x] Replace technical Supabase/database errors with clear user-facing messages and retry actions where a reload is possible.
- [x] Prevent duplicate submission and admin-action taps while a request is running.

### 4. Ranking, Owner and Rules polish

- [x] Highlight the logged-in owner in overall and phase rankings.
- [ ] Review tied rankings and match-to-match position movement.
- [x] Add Owner sorting by player points, royalty, cost and name where still missing.
- [ ] Confirm Unique/Marquee phase selection and deadline wording is easy to understand.
- [x] Add confirmation before an administrator publishes a new rule version.

### 5. Cross-platform layout review

- [ ] Check Android system-navigation spacing and sticky Submit XI visibility.
- [ ] Check iPhone safe areas, numeric OTP keyboard and modal buttons.
- [ ] Check mobile web, tablet and desktop widths.
- [ ] Test long league names, owner names and player names without overlap.

### 6. Deferred until a fixture locks and publishes

- [ ] Run the detailed **Deferred QA — fixture links after lock and publication** checklist under Milestone 5.

### 7. End-of-session checks

- [ ] Run `npm run typecheck`.
- [ ] Run `git diff --check`.
- [ ] Review changed files and preserve unrelated user files.
- [ ] Commit and push the verified changes.

## Milestone 1 — league configuration foundation

Status: implemented; staging regression evidence remains required.

- Apply and verify migration 018 in staging.
- Display invited/accepted/declined leagues on Home.
- Add owner accept/decline and admin activate/suspend controls.
- Read league acquisition/royalty/unique configuration into a typed client model.

Exit: one account can be active in IPL, decline World Cup and see only permitted data for each.

## Milestone 2 — templates and new league setup

Status: implemented for template creation/cloning, invitations and separate fixture/squad import. Migrations 040–041 close legacy transfer-period and special-rule snapshot gaps; import dry-run UI remains.

- Build template list and clone preview.
- Build draft league identity/configuration wizard.
- Import new season teams, players and fixtures with dry-run validation.
- Optionally copy owner emails as new invitations.

Exit: an admin creates IPL 2027 from an IPL template with new IDs, empty ownership, zero usage and no historical scores.

## Milestone 3 — acquisition modes

Status: auction/owned and all-open lineup/transfer behavior implemented. Live auction remains intentionally disabled.

- Refactor lineup and scoring services around acquisition mode.
- Implement all-open mode and hide irrelevant auction/squad UI.
- Re-enable auction only after server concurrency/reconnect testing.

Exit: auction and all-open leagues pass the same lineup/history test suite with mode-specific behavior.

## Milestone 4 — unique and royalty features

Status: rules, phase declarations, power restrictions, labels and score adjustments implemented. Complete the multi-owner phase-transition and published-score reconciliation matrix before release.

- Confirm royalty formulas and recipients.
- Add versioned player classifications and unique reservations.
- Enforce conflicts transactionally at submission/lock.
- Add royalty breakdown to player/member scores and history.

Next verification focus:

- phase 1 declaration, phase 2 change window and final-phase carry-forward;
- declared Unique restrictions for every owner and automatic-Unique borrower-only restrictions;
- regular and Marquee minimum/percentage royalty after C/VC/Impact/3X/2UP final contribution;
- template clone parity without competitive-state leakage.

Exit: unique-only works with royalty disabled; royalty leagues reproduce published calculations by version.

## Milestone 5 — production release

- Complete all P0 items in `PRODUCTION_READINESS.md`.
- Automate authorized score ingestion and reconciliation.
- Run nine-owner preview on physical iOS/Android devices.
- Prepare privacy/store metadata and signed builds.

### Deferred QA — fixture links after lock and publication

Status: TODO. Run this checklist when a test fixture has first been locked, and repeat it after points are published for that fixture.

After fixture lock:

- [ ] Confirm the fixture shows **View XI** only after it becomes locked/started.
- [ ] Tap **View XI** and confirm History opens the same match, scrolls it into view and expands it automatically.
- [ ] Confirm all submitted XIs, C/VC, BAI/BOI, 3X and other booster markers follow post-lock visibility rules.
- [ ] Confirm owners cannot see another owner's XI before lock, including through direct database reads or navigation.

After points publication:

- [ ] Confirm the action changes from **View XI** to **View scores**.
- [ ] Tap **View scores** and confirm History opens the same match, scrolls it into view and expands it automatically.
- [ ] Confirm owner totals, match ranks and each player's batting, bowling, fielding and bonus breakdown.
- [ ] For Unique/Royalty leagues, confirm usage fees, royalty adjustments and final totals are displayed correctly.

Platforms:

- [ ] Android physical device.
- [ ] iPhone physical device.
- [ ] Web browser at mobile and desktop widths.
