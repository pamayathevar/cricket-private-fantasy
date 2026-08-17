# Score ingestion and parsing runbook

## Purpose

This runbook defines the safe path from an authorized cricket score source to reviewed fantasy points. The first implemented automation is a provider-neutral compiler. It replaces hand-calculated point payloads, but it does **not** scrape a website, connect to Supabase, stage a calculation, or publish a result.

The authoritative lifecycle remains:

1. ingest source facts;
2. map provider identities to league players;
3. validate and normalize cricket facts;
4. calculate fantasy categories with the fixture's immutable rule set;
5. reconcile and review;
6. stage an immutable calculation version;
7. publish atomically through the existing admin-only workflow.

Keeping these boundaries separate prevents an unreliable parser, compromised client, or source correction from silently changing league standings.

## Current implementation

The repository now contains:

- `scoreImportRules.ts` — normalized import contract, validation gates, score compilation and reconciliation;
- `scripts/compile-score-import.mjs` — offline compiler that produces a review artifact;
- `docs/examples/score-import.sample.json` — provider-neutral example input;
- unit tests for successful compilation, missing player mappings and impossible score facts.

Run the example:

```sh
npm run score:compile -- \
  --input docs/examples/score-import.sample.json \
  --output /tmp/match-11-score-review.json
```

For production, export the fixture's exact immutable scoring rule document and pass it explicitly:

```sh
npm run score:compile -- \
  --input /secure/imports/match-11.normalized.json \
  --rules /secure/imports/match-11.rules.json \
  --output /secure/reviews/match-11.review.json
```

If `--rules` is omitted, the compiler uses `defaultScoringRules` and adds a warning. A warned artifact must not be staged until an administrator confirms that the local rules exactly match `ruleSetId` in the database.

## Input contract

The input is normalized JSON, not provider-specific HTML. A provider adapter may create this JSON only from a lawful API, licensed feed, or commissioner-controlled source.

Top-level identity fields:

- `schemaVersion` — currently `1`;
- `leagueId`, `fixtureId`, `ruleSetId` — UUIDs that keep the operation league- and version-specific;
- `matchNumber` — league fixture number;
- `source.provider`, `source.externalMatchId`, `source.sourceUrl`, `source.retrievedAt` — audit provenance;
- `expectedPlayerIds` — every player that must receive a row, including every player selected in any submitted XI for the fixture;
- `match` — teams, winner, Player of the Match, result summary and maximum legal balls per bowler;
- `players` — mapped league player identities and normalized batting, bowling and fielding facts;
- `scorecard` — optional display-safe scorecard payload retained as a raw fact.

`expectedPlayerIds` is critical. A selected fantasy player who did not enter the official playing XI still needs a zero-point row. Omitting that player would make a lineup incomplete and must block publication.

Each player must be mapped to the league's UUID before compilation. Provider display names are never accepted as database identity. Keep `providerPlayerId` when available so name changes and duplicate names remain traceable.

## Wicket and dismissal normalization

Bowler wickets list the dismissed player's mapped ID and league role. The compiler derives:

- bowler-victim wickets (`victimRole = BO`);
- non-bowler-victim wickets (`BA`, `WK`, or `AL`).

Run-outs belong under fielding and must not appear in bowler wickets. A wicket victim cannot be credited twice and must resolve to the mapped player list.

The batting `dismissal` value is the point-category value, not free text:

- `none` — not out, did not bat, or a dismissal with no duck penalty;
- `duck`;
- `golden-duck`;
- `diamond-duck`;
- `retired-out`;
- `retired-hurt`.

Store human-readable dismissal text only in the optional verified scorecard payload. Never infer caught/bowled/fielder text from fantasy totals.

## Validation gates

The compiler rejects an artifact when any error exists. Current gates include:

- valid league, fixture, rule-set and player UUIDs;
- source provider, external match ID, secure HTTPS URL and retrieval time;
- two distinct fixture teams and a valid winner;
- positive match number and bowler ball limit;
- unique expected players and mapped player rows;
- every expected player present;
- mapped Player of the Match in the playing XI;
- player team and role consistency;
- non-negative integer cricket counts;
- boundary runs not greater than total runs;
- dots and maidens not greater than legal balls;
- bowler allocation not above the configured limit;
- no batting or bowling figures for a player outside the playing XI;
- unique, mapped bowler-wicket victims.

A playing-XI count other than 22 produces a warning rather than an error because substitutions and exceptional match formats require commissioner review.

No Result, abandoned and cancelled fixtures do not use this scored-match compiler. Use the documented No Result settlement RPC so transfers are restored and future lineups are rebased correctly.

## Review artifact

The compiler writes JSON with:

- `status: ready-for-admin-review`;
- a SHA-256 `sourceFingerprint` over the normalized facts, stable source identity and rules;
- every validation warning;
- player and category reconciliation totals;
- the exact `stagingPayload` shape used by `stage_match_player_points`;
- raw source provenance and normalized facts;
- batting, bowling, fielding and bonus points;
- the explainable detail rows behind every category.

The fingerprint excludes `retrievedAt`, so retrying identical normalized facts produces the same value. A source correction changes the normalized facts and therefore produces a new value. The fingerprint lets a future backend ingestion-batch table identify a repeated source payload; it is not yet a database idempotency guarantee.

## Required admin review

Before staging, an administrator must compare the review artifact with the official source and confirm:

- league, fixture, teams and match number;
- source match ID and source URL;
- immutable rule-set ID and rule document;
- all submitted-XI players are in `expectedPlayerIds` and in the payload;
- playing XIs, substitutes and did-not-play entries;
- winner and Player of the Match;
- batting, bowling, fielding and dismissal facts;
- category totals and overall reconciliation;
- warnings have written resolution notes.

Staging creates a reviewable calculation version. Publishing remains a separate admin action and must continue through `publish_match_scores_safe`; never update public totals directly.

## Provider adapter design

The next production phase is a protected backend adapter with this interface:

```text
licensed provider response
  -> immutable raw response storage
  -> provider-player mapping
  -> normalized schema v1 JSON
  -> offline-equivalent validation/calculation
  -> ingestion batch (source fingerprint)
  -> admin review queue
```

Provider-specific code must be isolated from scoring rules. Replacing a provider should require a new adapter, not changes to fantasy calculations.

The adapter must run in a protected job or Edge Function. Store its API key only in backend secrets. Do not put provider keys, the Supabase service-role key, or publication authority in Expo, Netlify public variables, or a browser bundle.

## Remaining work before unattended ingestion

The compiler is a safe first layer, not full automation. Production ingestion still requires:

1. select and contract a lawful, reliable score provider;
2. create a league-scoped provider-player mapping table with an unresolved mapping queue;
3. create immutable raw-response and ingestion-batch storage;
4. enforce a unique source fingerprint per fixture for idempotent retries;
5. run the same compiler in a protected backend job using the fixture's database rule set;
6. fetch the submitted-XI player union and populate `expectedPlayerIds` server-side;
7. stage through an authenticated admin/service workflow without publishing;
8. add job retries, dead-letter status and operator alerts;
9. reconcile source facts, staged points, owner totals and standings;
10. rehearse correction, rollback and No Result recovery in staging.

Do not automate around a provider's access controls or rely on brittle website scraping. A parser that breaks silently is more dangerous than a slower commissioner-reviewed import.

## Incident and correction workflow

If the source is incomplete or corrected:

1. stop before publishing, or leave the currently published version active;
2. preserve the original source artifact and fingerprint;
3. retrieve the corrected authorized source as a new immutable artifact;
4. compile and reconcile again;
5. stage a new calculation version;
6. record the correction reason and reviewer;
7. publish the corrected version atomically;
8. verify player, owner, match and overall totals;
9. notify league members when a published result changes.

Never edit an already published calculation row in place.
