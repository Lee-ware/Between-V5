# BETWEEN V5 — Phase 1 Final QA Gate

## Scope
Phase 1 engineering hardening only. The existing dataset is intentionally retained for Phase 2 replacement.

## Verified
- 22 JavaScript files pass `node --check` (application + Netlify function files).
- App module integration smoke passes with all shipped modules loaded together.
- 623 current content items load with 0 duplicate IDs, 0 duplicate prompts, 0 missing required fields, and 0 structural content issues.
- Content-to-renderer compatibility audit passes for all current items.
- 7 active modes are selectable; Majority is archived and excluded from Surprise Me, Daily, onboarding, Pass the Phone, and new Time Capsule saves.
- 10 Brain mechanics are registered and difficulty-aware (easy/medium/hard).
- Answered-state persistence is separate from shown/seen state; library completion uses unique answered IDs.
- Result callbacks are token-guarded and duplicate result commits are blocked.
- Answered progress is content-version aware so a Phase 2 content-version bump cannot falsely report the new library as completed.
- Backup import sanitizes data and resets answered completion when the backup belongs to a different content version.
- User-content-derived rendered text is escaped in hardened rendering paths.
- PWA manifest parses successfully and all declared icons exist at their declared sizes.
- Service-worker precache contains 36 unique existing files; service-worker syntax passes.
- First-time service-worker installation no longer presents an update toast; update notification requires an existing controller.
- Netlify deployment configuration parses as expected; optional Majority function files pass JavaScript syntax checks.
- No temporary browser harness/test files are included in the Phase 1 package.

## Browser automation limitation
The available execution environment blocks the local Chromium/browser-automation layer needed for a true interactive browser smoke test. No browser-pass claim is made from that environment. Real-device/PWA testing remains part of Phase 4.

## Known intentional compatibility remnants
Legacy Majority renderer, scoring counters, storage keys, and optional crowd-function files remain in the codebase for backward compatibility and historical data. They are not active in the current navigation or new-play paths.
