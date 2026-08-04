# Core domain model

## League

Stores the season, invite code, commissioner, scoring preset, transfer limit, auction settings, and lineup-lock policy.

## Franchise

Belongs to one league and one owner. Tracks display name, auction balance, squad, and transfers used.

## Player

Represents an IPL player, including IPL team, playing role, overseas status, and active status.

## AuctionLot

Represents one nominated player. Contains the nominating franchise, opening price, current bid, leading franchise, status, and server-controlled expiry time.

## Bid

An immutable bid event containing the auction lot, franchise, amount, and server timestamp.

## RosterEntry

Links a player to exactly one franchise within a league and records acquisition type, acquisition price, and active dates.

## Match

Represents a real IPL fixture with scheduled start, teams, status, and lineup lock time.

## Lineup

Contains a franchise's 11 selected players for one match, plus captain and vice-captain. It becomes immutable at the lock time.

## Transfer

Records a released player, acquired player, effective match, price adjustment, competition stage, and whether the move counts toward the 105-transfer league-stage or 6-transfer playoff allowance.

## PlayerMatchScore

Stores raw cricket statistics, scoring-rule version, base points, bonuses, and correction history.

## FranchiseMatchScore

Aggregates the selected XI, including captain multipliers, into a match total and season total.

## AuditEvent

Records commissioner actions, auction corrections, scoring corrections, and other sensitive state changes.
