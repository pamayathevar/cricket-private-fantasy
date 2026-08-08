# Prioritized implementation plan

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
