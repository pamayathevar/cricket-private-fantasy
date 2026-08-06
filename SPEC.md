# Cricket Private Fantasy product specification

Status: working specification. Items marked **Planned** are requirements, not claims about the current app.

## 1. Product and roles

The app runs multiple private cricket fantasy leagues. Each league has its own owners, fixtures, players, acquisition mode, ownership, playing/scoring rules, phases, transfers, boosters and standings.

- **League admin:** creates/configures leagues, manages owners, imports data, runs bidding when enabled, publishes rules and reviews/publishes scores.
- **Owner:** opts into individual leagues, selects teams, uses transfers/boosters and views rankings/history.
- **Invited user:** accepts or declines each league separately and has no competition state until active.

## 2. Multi-league membership

The Home screen lists the signed-in user's leagues by status: invited, active, upcoming, declined/skipped and completed. A user can participate in IPL 2026, skip World Cup 2026 and later join IPL 2027.

Participation states are `invited`, `accepted`, `declined`, `active`, `suspended`, and `withdrawn`. Only accepted/active owners receive an owner slot, auction budget, squad, transfers and standings. Declining one league never affects another. Removing an owner after bidding/start requires an audited squad/result resolution workflow.

## 3. League creation

**Planned:** a saveable draft wizard:

1. Identity, season, timezone and start date.
2. Owner invitations, roles, capacity and opt-in deadline.
3. Player acquisition mode.
4. Player eligibility, marquee, unique and royalty settings.
5. Bidding/squad rules when ownership applies.
6. Playing-XI rules.
7. Phases and transfer periods.
8. Boosters and limits.
9. Points rules.
10. Validation, preview and publish.

Publishing rejects incomplete/conflicting configuration. Competition-defining options lock at league start. Permitted later rules use a new version and effective match.

## 4. Player acquisition modes

### Auction ownership

Current foundation exists; production live auction is deferred. Budget, squad size, roles, team limits, bid increments and auction operation are configurable. Unpurchased players remain open. Owners may select owned, open and other-owner players according to transfer and deduction rules.

### All-open league — Planned

- No bidding or private ownership; every eligible player is available to every owner.
- Hide owner-squad, auction-price and other-owner deduction behavior.
- Transfers may still apply to lineup changes under the configured transfer policy.
- Unique restrictions remain an independent option.

### Unique-player-driven league — Planned

- Royalty points are disabled.
- Every owner selects exactly two players from their owned squad as Unique Players for each phase.
- Initial selections must be completed before the Phase 1 selection deadline.
- A later non-playoff phase's selection window opens only when the preceding phase starts and closes 24 hours before the later phase's first match. Future phases are not selectable early. After the deadline, selections remain fixed for the phase.
- If an owner makes no valid change before the deadline, the previous phase's two Unique Players carry forward automatically.
- Changes are not allowed for the final/playoff phase. The two Unique Players from the preceding phase carry forward into the playoffs.
- An injured, withdrawn or deactivated Unique Player cannot be replaced during the current phase. The owner may change that player only during the next eligible phase-selection window. If the next phase is the final/playoff phase, the existing selection carries forward and no replacement is allowed.
- Unique Players remain selectable in every owner's XI; uniqueness does not reserve or remove the player from other owners.
- A phase-selected Unique Player cannot receive Captain, Vice-Captain, BAI, BOI or `3X` from any owner, including the owning owner.
- An owner using another owner's player pays an other-player usage fee equal to the greater of 30% of that player's otherwise eligible final contribution or 15 points.
- The usage fee is deducted even when the player's final contribution is zero: 100 points becomes 70, while 0 points becomes -15.
- `2UP` applies after the other-player usage fee. `SUP-TR` changes transfer charging only and never bypasses Unique restrictions.

League-admin configuration includes the number of Unique Players per owner, percentage usage fee, minimum fixed usage fee, phase-change deadline, power-player restrictions and mid-phase replacement policy. Defaults are two Unique Players, 30%, 15 points, 24 hours, no C/VC/BAI/BOI/`3X`, and no replacement.

## 5. Royalty-driven league — Planned

- Every owner selects exactly two players from their owned squad as Marquee Players for each phase.
- Initial selections must be completed before the Phase 1 selection deadline.
- A later non-playoff phase's selection window opens only when the preceding phase starts and closes 24 hours before the later phase's first match. Future phases are not selectable early. After the deadline, selections remain fixed for the phase.
- If an owner makes no valid change before the deadline, the previous phase's two Marquee Players carry forward automatically.
- Changes are not allowed for the final/playoff phase. The two Marquee Players from the preceding phase carry forward into the playoffs.
- An injured, withdrawn or deactivated Marquee Player cannot be replaced during the current phase. The owner may change that player only during the next eligible phase-selection window. If the next phase is the final/playoff phase, the existing selection carries forward and no replacement is allowed.
- When another owner uses an owned player, the borrowing owner keeps 100% of that player's final credited contribution; royalty is an additional credit and is not deducted from the borrower.
- The owning owner receives the greater of 5% or 5 points for a regular player, and the greater of 15% or 15 points for a Marquee Player, for every other owner who uses that player.
- Royalty is calculated independently for every borrowing owner and summed for the owning owner. An owner generates no royalty by using their own player.
- The royalty base is the borrowing owner's final credited contribution for that player after applicable Captain, Vice-Captain, BAI/BOI, `3X` and `2UP` multipliers.
- Royalty can never be negative. The configured minimum still applies when the final credited contribution is zero or negative: 5 points for a regular player and 15 points for a Marquee Player by default.
- Each borrowing owner's royalty amount is rounded to a whole point immediately before it is credited and before multiple royalty credits are summed.
- Only one booster may be active for a match. `3X`, `2UP` and `SUP-TR` cannot be combined with one another, so a royalty calculation can include `3X` or `2UP`, never both.
- Example: a 100-point Marquee Player used as Captain plus `3X` contributes 600 to the borrower and 90 royalty points to the owner. Used as Captain with `2UP`, the attributed contribution is 400 and royalty is 60.

League-admin configuration includes the number of Marquee Players per owner, regular and Marquee royalty percentages, separate minimum royalty amounts, royalty rounding policy, phase-change deadline and mid-phase replacement policy. Defaults are two Marquee Players, 5% with a 5-point minimum, 15% with a 15-point minimum, immediate whole-point rounding, 24 hours, and no replacement.

### Automatic Unique status in a Royalty-driven league

- Usage is one appearance in an owner's locked submitted XI.
- Usage accumulates across the full league and does not reset at phase boundaries.
- When usage exceeds 48 (the 49th locked appearance), the player becomes automatically Unique beginning with the next match. Locked and published matches are never recalculated.
- Other owners may continue selecting an automatically Unique player but cannot assign Captain, Vice-Captain, BAI, BOI or `3X` to that player.
- The owning owner may still apply power markers to their automatically Unique player.
- Automatic Unique status does not remove Marquee status. If the owner selected the player as Marquee for the phase, the 15% royalty rate continues.

The automatic-Unique usage threshold and restricted power-player markers are league-admin configuration. Defaults are 48 completed appearances and no C/VC/BAI/BOI/`3X` for borrowers after the threshold.

Royalty and automatic-Unique calculations must be versioned, pinned to each published match and displayed as separate explainable breakdowns.

### Phase selection timing

- The deadline is calculated from the scheduled start of the first fixture in the target phase, using server time.
- For a configurable league, the admin identifies which phase is the final/playoff phase; the application must not assume a fixed phase number.
- Owners may save revisions before the deadline. The latest valid two-player selection becomes effective for the target phase.
- The server rejects late changes even if a stale client still displays an edit control.
- Rescheduling a phase's first fixture must use an audited admin workflow and explicitly decide whether the selection deadline moves; it must never silently reopen a closed selection window.

### Rule administration and effective dates

- Only active league admins may edit Unique, Marquee, royalty and automatic-Unique settings in the Rules tab. Owners receive a read-only view.
- Rules are versioned. Every saved version records the administrator, timestamp, previous values and new values.
- An administrator must choose an effective-from match when publishing a rule version.
- A new version may affect only unlocked matches at or after its effective match. Submitted but unlocked lineups must be revalidated and clearly flagged if they no longer comply.
- Locked or published matches retain the rule version already assigned to them and are never silently recalculated.
- Changes to phase selections or their deadline/replacement policy cannot bypass a selection window that has already closed.

## 6. League templates — Planned

An admin can create a new draft league from a previous league/template.

Copied by default: playing/points rules, boosters, relative phase structure, transfer policy, acquisition/bidding settings, royalty/marquee/unique policy and display preferences.

Optionally copied: owner emails reset to `invited`, cricket teams and reusable player classifications after mapping to the new season.

Never copied: player ownership, bids, budgets, lineups, transfer/booster usage, fixtures, points, standings, ranks or historical IDs. The new league gets new IDs and draft rule versions. New squad/fixtures are imported, and auction mode always runs fresh bidding for new ownership. Templates are versioned snapshots and do not inherit later changes.

## 7. Lineups, transfers and boosters

- Lineup size, budget, roles, team limits and eligibility come from the fixture-effective playing rules.
- C, VC, BAI and BOI are optional and mutually exclusive on a player.
- A submitted XI carries forward; boosters never carry forward.
- Reset restores the last submission/carried team; Clear removes all players.
- Fresh non-owned, non-playing-match selection warns; carried-forward selections do not.
- Lock uses server time. Other owners' lineups become visible only under the configured post-start rule.
- Transfer periods are configurable non-overlapping match ranges with allowances and optional free/reset first match.
- Booster catalog, target, combinations, phase eligibility and limits are league configuration. IPL 2026 behavior remains in `confirmed-rules.md`.

## 8. Scoring workflow

1. Import trusted match facts through an authorized source.
2. Resolve source players to league players.
3. Calculate discipline points using fixture-effective scoring rules.
4. Validate completeness for every selected player.
5. Stage for admin review.
6. Apply markers, boosters, ownership deductions and optional royalty.
7. Publish atomically and update match/phase/overall rankings.

Player detail shows rounded batting, bowling, fielding, bonus, royalty, deductions, multipliers and final total. Corrections create a new calculation version and audited republish; published history is never silently modified.

## 9. Rankings, history and permissions

- Ranking provides Overall plus every configured phase.
- History lists match-ranked owners; owner expansion shows XI, ownership, markers, boosters, transfers used/balance; player expansion shows scoring breakdown.
- Team badges use consistent colors throughout.
- Authentication alone grants no league access. RLS enforces league membership/role.
- Owners edit only their unlocked lineup. Only admins publish configuration/scores.

## 10. Definition of configurable

A configurable feature is complete only when it is stored per league, editable during draft setup, validated server-side, read dynamically by the client, pinned/versioned in history, RLS-protected, safely cloneable when applicable, and verified against at least two different league configurations.
