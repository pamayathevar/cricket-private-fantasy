# UI/UX remediation checklist

This checklist tracks the mobile and web improvements identified during the responsive audit on August 10, 2026.

## P0 — Accessibility and usability

- [x] Raise frequently read text to practical mobile minimums.
- [x] Ensure normal text meets WCAG AA contrast (4.5:1).
- [x] Give frequent mobile controls at least a 44–48 px touch target.
- [x] Add roles, labels, selected/expanded states, and announcements to custom controls.
- [x] Add visible keyboard focus treatment for the web build.
- [x] Verify modal focus containment and focus restoration.

## P1 — Responsive navigation and layout

- [x] Keep compact bottom navigation active through tablet widths where seven desktop tabs do not fit comfortably.
- [x] Use the same primary destination order on mobile and desktop.
- [x] Verify the sticky submit action at 320, 390, and 430 px widths.
- [x] Add an affordance where fixture, phase, and filter rows scroll horizontally.
- [x] Verify 200% browser zoom and 320 px reflow without loss of functionality.

## P1 — Visual system

- [x] Use darker text variants for colorful active navigation labels.
- [x] Reserve green, amber, and red for success, warning, and destructive states.
- [x] Reduce unnecessary screen-to-screen accent changes while retaining cricket/team colors.
- [x] Normalize card radii, borders, and shadows into reusable design tokens.

## P2 — Content and interaction polish

- [x] Shorten the narrow-screen sticky submission summary.
- [x] Review labels such as `Owner` and `League` for clarity.
- [x] Add consistent pressed, loading, empty, offline, and permission-error states.
- [ ] Test with VoiceOver and TalkBack on physical devices.

## Acceptance checks

- [x] `npm run typecheck`
- [x] `git diff --check`
- [x] `npm run check`
- [x] Browser verification at 320, 390, 700, 900, 1180, and 1440 px.
- [ ] Keyboard-only smoke test on web.

## Verification notes

- Rendered visible-text contrast checks report no WCAG AA failures on League, Standings, Fixtures, Match History, Player Pool, Owner Squads, and League Rules.
- Rendered control checks report no unnamed visible controls and no visible interactive targets below 24×24 px; frequent product controls target 44×44 px.
- Keyboard focus styling and DOM focus order are present. A full physical-keyboard interaction pass remains pending alongside physical-device screen-reader testing.
