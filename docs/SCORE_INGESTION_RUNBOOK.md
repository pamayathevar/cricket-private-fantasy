# Score ingestion and parsing runbook

## Purpose

This runbook defines the safe path from an authorized cricket score source to reviewed fantasy points. The implemented workflow combines a provider-neutral compiler, an admin-only URL request queue, a protected Supabase Edge Function and an idempotent staging boundary. It replaces hand-calculated point payloads, but it does **not** bypass source access controls or publish a result automatically.

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
- `scoreIngestionArtifact.ts` — browser-side review-artifact validation before an administrator can stage it;
- `scripts/compile-score-import.mjs` — offline compiler that produces a review artifact;
- `docs/examples/score-import.sample.json` — provider-neutral example input;
- `supabase/migrations/202608040072_score_ingestion_batches.sql` — the immutable ingestion ledger and validated staging RPC;
- `supabase/verify_migration_072.sql` — read-only RLS, privilege, idempotency and publication checks;
- `supabase/migrations/20260817221734_score_ingestion_jobs.sql` — admin-requested URL jobs, RLS and the request-only RPC;
- `supabase/verify_migration_075.sql` — read-only job-table, grants and RLS verification;
- `supabase/functions/ingest-score-source/index.ts` — authenticated, allow-listed server-side source retrieval and adapter orchestration;
- unit tests for compilation, mappings, impossible facts, fixture identity, duplicate rows and reconciliation.

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

The direct-wicket bonus applies when no fielder assists the bowler, including bowled, LBW and hit-wicket dismissals. It does not apply to catches or stumpings. Caught-and-bowled is still a caught dismissal, so it receives normal wicket points and catch points but no direct-wicket bonus.

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

The importer accepts 11–12 official match participants per team (22–24 total) without an exception. The twelfth participant covers the IPL Impact-substitute rule; both the outgoing player and the Impact substitute remain eligible for their recorded contributions. A verified Impact or concussion substitute who bats or bowls is included and receives those category points. If this produces 13 or more participants for a team, the compiler generates a warning and the administrator must identify the extra participant and approve the exception in required review notes before staging. Fewer than 11 core participants remain a capture error because that normally indicates missing names or aliases. A fielding-only substitute remains visible in the verified dismissal text, but catch, stumping and run-out points are ignored unless **Playing Rules → Substitute fielder points** is enabled for that fixture. The fixture-effective default is OFF.

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

The fingerprint excludes `retrievedAt`, so retrying identical normalized facts produces the same value. A source correction changes the normalized facts and therefore produces a new value. Migration 072 enforces one fingerprint per fixture: an identical retry returns the existing batch without creating another calculation version, while a different artifact claiming the same fingerprint is rejected.

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

In League Admin → Match Scoring, choose **Import score source**. The preferred **Provider URL** tab submits an authorized URL to the protected backend or restricted Chrome extension; **Scorecard capture** is the guided manual fallback, and **Review** exposes the validated artifact. A URL request creates an audited job and, when a configured adapter returns a valid artifact, opens that artifact for administrator review. Artifacts with warnings require written review notes. **Stage for review** creates a calculation version and an immutable ingestion-ledger row. Publishing remains a separate admin action and must continue through `publish_match_scores_safe`; never update public totals directly.

The handoff-ready, step-by-step procedure for league administrators is [Administrator guide: capture, review, and publish match scores](./ADMIN_SCORE_PUBLISHING_GUIDE.md).

### Local visible-browser ESPNcricinfo capture

For this small private league, an administrator can prepare a review without a paid provider adapter by using a restricted local Chrome extension. It reads the scorecard rendered in the administrator's visible browser; it does not bypass access controls, stage data, publish scores or contain database credentials.

One-time installation:

1. Open `chrome://extensions` in Google Chrome and enable **Developer mode**.
2. Select **Load unpacked** and choose this repository's `browser-extension` folder.
3. Reload the Cricket Rivalries app. The Provider URL screen must say **Browser capture extension connected**.

One-time league configuration:

1. In **Rules → Match Scoring**, paste the ESPNcricinfo series schedule URL and Cricbuzz series matches URL under **Automatic scorecard URLs**.
2. Select **Discover & save fixture URLs**. The extension opens both series pages visibly and returns their match links.
3. The app maps only exact match-number and two-team identities, optionally verifies the provider date, and saves the URLs through `configure_scorecard_series_sources` with an audit event. Ambiguous mappings fail closed.
4. Verify the per-fixture **CRICINFO READY** and **CRICBUZZ READY** indicators. Rerun discovery later for links that were not yet listed.

For each match:

1. In **Rules → Match Scoring**, select **Import score source** for the correct fixture.
2. Confirm the prefilled ESPNcricinfo **Full Scorecard** URL, or paste it manually if series discovery did not find that fixture.
3. Select **Capture scorecard & generate preview**. Chrome opens the page visibly and returns to the admin tab after all four tables are rendered.
4. Independently inspect the match identity, innings totals, dismissals, dot balls, player/category totals, winner and Player of the Match.
5. Select **Stage for review** only after the preview is correct. Publishing remains a separate action and confirmation.

After staging, select **Publish scores**, review the final warning, and select **Confirm publish now**. Do not close the dialog until **Match _n_ published** confirms that player points, owner totals, and rankings were updated. Then verify the fixture in both **Results** and **Ranking**.

The **Scorecard capture** tab remains the no-terminal manual fallback if the extension is not installed or Cricinfo changes its page structure. The legacy visible-browser command is also available for diagnostics:

   ```bash
   npm run score:fetch -- --url "<ESPNcricinfo match URL>" --match 21 --app-url http://localhost:8081
   ```

The local browser and app must be on the same computer. The local app must already be signed in; the automation never reads a login code. The parser rejects missing dot-ball data, invalid cricket overs, unresolved or ambiguous names, incomplete XIs, mismatched wickets and category reconciliation errors. If a displayed name differs from the league record, add a reviewed alias in the Local capture form using `Cricinfo name = Exact league player name`, then generate the review again.

If the scorecard is captured but the app URL is unavailable, start the web app, note the port it prints, and reuse the saved capture without visiting ESPNcricinfo again:

```bash
npm run score:fetch -- --capture ".local/score-imports/match-21-srh-vs-rr.capture.json" --app-url http://localhost:8081
```

The fields in **Scorecard capture** remain available as a manual fallback. Preserve every `Did not bat` row and the bowling dot-ball column (`0s`, `Dots`, or `D`). Screenshots alone are not parsed.

Use only scorecard content the administrator is authorized to view. For a Super Over, unusual substitution, incomplete scorecard, or source layout the parser cannot reconcile, stop and use a manually reviewed normalized artifact or correction workflow instead of forcing the import.

The low-level `stage_match_player_points` RPC is deliberately not executable by browser users. The validated `stage_score_ingestion_batch` RPC independently rechecks admin authority, fixture state and identity, the effective rule set, source fingerprint, warning disposition, player UUIDs, duplicate rows and reconciliation totals before it invokes the internal writer.

If corrected source facts arrive, compile a new artifact. Its new fingerprint stages a new calculation version and marks the earlier staged batch as superseded. Published batches remain in the ledger and must never be edited or deleted.

When an existing Cricinfo copy-and-paste batch already contains all four captured scorecard tables, the Match Scoring card exposes **Regenerate saved scorecard**. This browser-side action reloads those immutable source tables from the stored review artifact, resolves the fixture-effective scoring rule set, and produces a fresh preview and fingerprint. It never stages or publishes automatically. Use Scorecard capture only when the saved artifact is incomplete or the source facts themselves must be corrected.

## URL import and provider adapter design

The Edge Function accepts only authenticated league administrators and approved HTTPS sources. ESPNcricinfo (including its legacy `cricinfo.com` domain) and Cricbuzz, including their subdomains, are included in the narrow built-in host allowlist; `SCORE_SOURCE_ALLOWED_HOSTS` can add comma-separated exact hosts or wildcard subdomains for an authorized provider. It rejects credentials in URLs, IP/localhost targets, non-standard ports, redirects and responses over 2 MB. Browser users can request a job but cannot insert or update job rows directly.

If the approved source already returns schema-v1 review JSON, the function can validate and return it directly. Normal scorecard pages require an authorized adapter configured with:

- `SCORE_INGESTION_ADAPTER_URL` — protected adapter endpoint;
- `SCORE_INGESTION_ADAPTER_TOKEN` — backend-only bearer credential;
- `SCORE_SOURCE_ALLOWED_HOSTS` — optional comma-separated additional exact hosts or entries such as `*.provider.example`; it does not replace the built-in ESPNcricinfo/Cricbuzz host list.

The adapter receives the requested URL plus the database fixture identity and must return a complete review artifact. It must map provider player IDs to league UUIDs, retrieve the effective immutable rule set, include every selected player, calculate all point categories, reconcile totals and preserve source provenance. A generic Cricbuzz or ESPNcricinfo web URL is not sufficient until an authorized provider-specific adapter exists.

The next production phase is a protected backend adapter with this interface:

```text
licensed provider response
  -> immutable raw response storage
  -> provider-player mapping
  -> normalized schema v1 JSON
  -> offline-equivalent validation/calculation
  -> validated ingestion batch (source fingerprint)
  -> admin review queue
```

Provider-specific code must be isolated from scoring rules. Replacing a provider should require a new adapter, not changes to fantasy calculations.

The adapter must run in a protected job or Edge Function. Store its API key only in backend secrets. Do not put provider keys, the Supabase service-role key, or publication authority in Expo, Netlify public variables, or a browser bundle.

## Remaining work before unattended ingestion

The compiler is a safe first layer, not full automation. Production ingestion still requires:

1. select and contract a lawful, reliable score provider;
2. implement and deploy its adapter behind `SCORE_INGESTION_ADAPTER_URL`;
3. create a league-scoped provider-player mapping table with an unresolved mapping queue;
4. store immutable licensed-provider raw responses outside the public client;
5. run the same compiler in the protected adapter using the fixture's database rule set;
6. fetch the submitted-XI player union and populate `expectedPlayerIds` server-side;
7. add asynchronous retries, a dead-letter status and operator alerts;
8. reconcile source facts, staged points, owner totals and standings;
9. rehearse correction, rollback and No Result recovery in staging.

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

## Deployment and rollback

Deploy in this order:

1. take a production database backup and apply migrations 072 and 075 in staging;
2. run `verify_migration_072.sql` and `verify_migration_075.sql`; require every boolean to be `true`;
3. set the three Edge Function secrets above and deploy `ingest-score-source`;
4. request an allowed URL as an admin and confirm a non-admin cannot request or read the job;
5. compile/import a known fixture twice and confirm the second staging response is idempotent;
6. stage a deliberately corrected artifact and confirm it creates the next calculation version;
7. publish only after checking staged player/category totals and verify standings once;
8. apply the migration, function, secrets and verification to production;
9. deploy the client only after the database and function gates pass.

Example deployment commands (run from the repository with the correct linked Supabase project):

```sh
npx supabase db push
npx supabase functions deploy ingest-score-source
npx supabase secrets set \
  SCORE_SOURCE_ALLOWED_HOSTS=api.authorized-provider.example \
  SCORE_INGESTION_ADAPTER_URL=https://adapter.example/compile \
  SCORE_INGESTION_ADAPTER_TOKEN=replace-with-backend-secret
```

Do not place the adapter token, provider API key or service-role key in `.env.local`, Expo public variables or Netlify public variables.

Rollback is forward-only. The client can be rolled back without deleting the ingestion ledger. If staging must be paused, revoke execution of `stage_score_ingestion_batch` from `authenticated` in a new repair migration. Do not re-grant browser access to `stage_match_player_points`, delete audit events, drop published batches, or rewrite published point rows. Correct defects with a new migration and a new calculation version.
