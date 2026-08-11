# Product UI/UX audit — August 11, 2026

## Scope

The audit covers authentication, league selection, lineup submission, standings, match history, fixtures, player pool, owner squads, mobile/desktop navigation, dialogs, loading/empty/error states, and league administration.

## Standards used

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): 4.5:1 normal-text contrast, 200% text resize, visible focus, focus order, and minimum target spacing.
- [WCAG target size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): at least 24×24 CSS px at Level AA; this product targets 44×44 for frequent touch controls.
- [Apple button guidance](https://developer.apple.com/design/human-interface-guidelines/buttons): clear action hierarchy, visible press state, and a 44×44 pt hit region.
- [Apple tab-bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars): stable top-level destinations; navigation tabs must not be mixed with actions.

## Audit findings

### Information architecture

- The four primary mobile destinations are correctly persistent: League, Ranking, History, and Fixtures.
- Player Pool, Owner Squads, and Rules are appropriate secondary destinations under More on mobile and visible top-level destinations on desktop.
- Screen naming was inconsistent: `Player Pool` opened `IPL Squad`, and `History` opened `Team History`.
- The lineup screen has the right information but initially presents too many competing accent colors.

### Visual system

- The source contained more than 100 literal colors. Many were near-duplicates, making screens feel unrelated.
- Rainbow tab colors and full-row owner colors competed with cricket-team colors and status colors.
- Purple Marquee panels looked like a separate product rather than a league feature.
- Team colors are useful identifiers and should remain local to team badges and narrow card accents.

### Typography and density

- Numerous labels were 5–9 px. These are difficult to read on phones and visibly undersized on desktop.
- Dense screens need compact typography, but supporting text still needs a practical 11–13 px floor and clear line height.
- Uppercase labels work for short metadata, not for instructions or primary actions.

### Interaction and accessibility

- Core navigation and lineup controls already use semantic roles and visible web focus.
- Several filter, expansion, admin, and history controls lacked selected/expanded/disabled state metadata.
- Mobile dialogs now contain focus and restore it to their trigger.
- Frequent controls should maintain a 44 px target even where the visual button is smaller.

## Redesign direction

- Deep evergreen/navy: global navigation, primary actions, summary bands.
- Lime: sparing emphasis for active icons, important figures, and primary text on dark surfaces.
- White and cool neutral surfaces: cards, filters, tables, and secondary actions.
- Green/amber/red: success, caution, and destructive/error states only.
- Team and owner colors: identity accents, not full-screen or full-row backgrounds.
- One icon-container style across mobile and desktop, with simple cricket/product glyphs and visible text labels.
- Consistent page names: Player Pool, Match History, Standings, Fixtures, Owner Squads, League Rules.

## Implemented in this pass

- Unified primary navigation colors and replaced chess-style owner/ranking icons.
- Neutralized ranking rows while retaining podium and current-owner emphasis.
- Reworked Marquee/phase-selection surfaces into the shared evergreen system.
- Unified lineup summary color and reduced isolated ownership-card washes.
- Added a shared typography normalizer for legacy 5–10 px labels.
- Removed top-level sheet rounding so desktop and mobile pages share one stable canvas.
- Standardized screen naming and expanded accessibility state metadata on production controls.
- Standardized user-facing ownership copy (`Open players`, `My players`, `Other owners`) and shortened narrow-screen lock labels.
- Added scroll-position resets so a newly opened secondary or administration screen always begins with its heading visible.
- Darkened supporting text, role colors, team badges, and status badges that fell below WCAG AA contrast.
- Added accessible labels to authentication, lineup, filters, expansions, player editing, owner management, template, phase, transfer, and score-publication controls.

## Verification

- Responsive visual review: 320, 390, 700, 900, 1180, and 1440 px.
- No document-level horizontal overflow at the audited mobile or desktop sizes.
- Rendered contrast checks: no visible normal-text failures on League, Standings, Fixtures, Match History, Player Pool, Owner Squads, or League Rules.
- Rendered interaction checks: no unnamed visible controls and no visible interactive target below the WCAG 24×24 px minimum on the audited screens.
- Automated checks: TypeScript, 30 unit tests, secret scan, web export, and diff whitespace validation pass.
- Still pending: VoiceOver and TalkBack testing on physical devices, plus a full physical-keyboard traversal pass.
