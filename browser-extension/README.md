# Cricket Rivalries scorecard capture extension

This Chrome Manifest V3 extension reads a visible ESPNcricinfo Full Scorecard and returns the four rendered tables to the Cricket Rivalries admin review screen. When Cricinfo supplies an ambiguous fielder surname, it can also read the matching Cricbuzz scorecard to validate that dismissal. It cannot access Supabase, stage a score or publish a score.

## One-time local installation

1. Open `chrome://extensions` in Google Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository's `browser-extension` folder.
5. Reload the Cricket Rivalries web app.

The Match Scoring dialog will show **Browser capture extension connected**. Paste an ESPNcricinfo Full Scorecard URL and select **Capture scorecard & generate preview**.

If the app cannot uniquely resolve a catcher, wicketkeeper or run-out fielder, it will then ask for the matching Cricbuzz scorecard URL. Select **Validate with Cricbuzz & generate preview**. Cricinfo remains the primary source; Cricbuzz changes only the ambiguous fielder names, and those corrections are saved in the review audit data. Manual aliases remain available as a fallback.

## Permissions

- The bridge runs only on the local Cricket Rivalries app and the documented production domains.
- Primary scorecard extraction runs only on `espncricinfo.com` or `cricinfo.com`; targeted dismissal validation also allows `cricbuzz.com`.
- The extension returns scorecard facts to the requesting admin tab and has no database credentials.
- A captured score remains an unpublished review until the administrator separately stages and confirms publication.

Keep the guided manual capture form available if Cricinfo changes its page structure or Chrome blocks the extension.
