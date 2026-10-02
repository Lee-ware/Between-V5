# BETWEEN v5.0.0 — Release Candidate QA

## Automated checks

- Content total: 623
- Modes: 8
- Duplicate IDs: 0
- Duplicate prompts: 0
- Pick One / Majority option structure: PASS
- Knowledge option/answer alignment: PASS
- Scenario option structure: PASS
- Estimation target/unit structure: PASS
- Brain explicit game types: PASS
- Brain supported mechanics: 10
- Majority backend allowlist: 60 current questions
- JavaScript syntax: PASS
- Netlify function syntax: PASS
- Service-worker precache paths: PASS
- Manifest standalone display: PASS
- Security headers present: PASS
- `eval` / `new Function`: none found
- App version: 5.0.0
- Content version: 2.0
- Storage schema: 2
- Cache version: between-v5.0.0
- Package version: 5.0.0

## Implemented V5 changes

- 623-item content library.
- General tactile sound layer with sound enabled by default for new installs, respecting the global setting.
- Contextual install nudge after several completed experiences when a real browser install prompt is available.
- Install action hidden in standalone PWA mode.
- Pass the Phone round lengths: 5 / 10 / 15 / 20.
- Brain mechanics expanded with explicit memory reverse, change detection and rule switching, alongside the existing mechanics.
- Duel token validation hardened.
- Majority allowlist expanded to all current Majority content.
- You vs You profile section using completed Time Capsule comparisons.
- Whole-library completion moment based on answered unique experiences.
- Independent app/content/storage/cache version identifiers.

## Manual/device verification still required

These cannot honestly be certified from the static build environment:

1. Actual Android Chrome gameplay.
2. Installed Android PWA launch.
3. Offline launch after a fresh install.
4. Offline launch after a V5 update from an older cached release.
5. Browser install prompt behavior on a supported Android browser.
6. Audio behavior through an actual phone speaker.
7. Android back gesture across all navigation paths.
8. Screen-reader behavior on a physical device.
9. Real Netlify Majority requests against deployed Blobs storage.
10. End-to-end two-device Duel sharing over a deployed URL.

The Chromium headless environment available during build verification hung before producing a reliable DOM result, so it is not represented as a passing browser/device test.


## Recheck pass
- Final content count: 623 (60 Brain)
- Prediction schema issue `between_0211`: corrected to binary choice
- Brain renderer map: all 10 declared game types wired
- Obvious near-duplicate wording: reduced
- Library completion moment: no logo flourish
- Physical Android/offline/update testing: still requires device verification
