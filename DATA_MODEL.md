# Configurable league data model

## Aggregate boundaries

```text
auth.users
  └─ league_members (one participation record per league)
       └─ league-scoped lineups, transfers, boosters and scores

leagues
  ├─ league_format_configs (one immutable-at-start format record)
  ├─ league_members
  ├─ league_players (season eligibility and optional ownership)
  ├─ lineup_rule_sets (versioned/effective by match)
  ├─ scoring_rule_sets (versioned/effective by match)
  ├─ league_phases
  ├─ league_transfer_periods
  ├─ booster_rules
  ├─ fixtures and competition history
  └─ audit_events

players (global team/role identities retained for cross-season history)
  └─ league_players (the exact identity eligible in one league season)

league_templates
  └─ versioned JSON snapshot of configuration only
```

## Format configuration

`league_format_configs` is one row per league and contains competition-defining choices:

- acquisition mode: `auction` or `all_open`;
- ownership, bidding and other-owner deduction switches;
- independent marquee, unique-player and royalty switches/configuration;
- unique scope and conflict policy;
- setup lifecycle: draft, published, locked.

The current model uses validated JSON objects for formulas/classifications whose exact business design is not confirmed. When a formula stabilizes, frequently queried fields should graduate to typed columns or child tables through a later migration. The format row is locked outside league setup; match-effective playing and scoring rules remain separately versioned.

## Membership lifecycle

`league_members` is both the invitation and participation record:

```text
invited → accepted → active ↔ suspended
    └──→ declined       └──→ withdrawn/disabled
```

Acceptance is an owner action. Activation is an admin action, keeping league capacity and late-entry decisions controlled. Membership is linked to `auth.users` by normalized email whether the Auth account exists before or after the invitation.

Only `active` membership grants normal league-data access. Separate self-read policies expose a user's own invitation and league summary without granting access to squads, fixtures or scores.

## Template boundary

A template snapshot contains:

- source competition defaults;
- league format configuration;
- latest playing and scoring configuration;
- phases, transfer periods and boosters;
- optional owner invitation identities.

It deliberately excludes all transactional state: players/ownership, auctions, fixtures, lineups, transfer events, booster usage, points, standings and historical audit records. Cloning creates a new setup league, active creator-admin, draft format, v1 rules and new configuration IDs.

## Season-scoped player identity

`players` deliberately retains historical team/role identities. The same real
player can therefore have a different `players` row after moving IPL teams in a
later season. `league_players` is the season boundary: only the name + team +
role identity imported for that league's competition year may be active.

Migration `065` enforces one active normalized player name per league, retires
stale cross-season identities from IPL 2026 pools, and preserves later-season
records for history. Roster imports deactivate the previous league pool before
activating the authoritative year's exact name + team identities. Lineups and
score history continue to reference immutable player IDs rather than being
rewritten when a player changes teams in a future IPL season.

## Next model extensions

Migration 018 creates the configuration foundation but does not claim runtime enforcement for new formats. Follow-up migrations should add:

1. Versioned `league_player_classifications` for marquee/unique eligibility.
2. Transactional `unique_player_reservations` keyed by configured scope.
3. Typed royalty rule versions after the formula is confirmed.
4. Separate royalty/deduction breakdown storage or a versioned calculation ledger.
5. Acquisition-mode resolution inside lineup, transfer and score-publish RPCs.

Every extension must preserve published calculations and must be covered by RLS and concurrency tests.
