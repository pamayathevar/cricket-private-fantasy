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

### Unique-players-only league — Planned

- Royalty points are disabled.
- A protected player can appear in only one owner's locked lineup for the configured match, phase or league scope.
- Conflict policy is configured before start. Default: earliest valid submission retains the player; later conflicts must be changed before lock.
- Can operate with auction ownership or an open pool if enabled.

## 5. Marquee, unique and royalty points — Planned

These are independent configuration switches:

- **Marquee:** an admin/import-tagged player receiving configured special treatment.
- **Unique:** a player whose simultaneous selection is restricted.
- **Royalty:** an additional points adjustment; royalty does not make a player unique.

Configuration includes:

- royalty enabled/disabled;
- formula: fixed points, percentage, multiplier or table;
- recipient: selecting owner, owning owner, or both;
- eligibility: marquee, unique, owned or explicit player list;
- caps and positive/negative treatment;
- unique enabled/disabled, scope and conflict policy;
- marquee/unique source and effective period.

Royalty must appear as a separate, versioned points-breakdown category. Exact royalty formulas require business confirmation before implementation; the data model must not assume one formula.

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

