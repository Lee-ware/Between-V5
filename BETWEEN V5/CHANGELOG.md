
## V5 Brain progression refinement — FIX2
- First 10 completed normal Brain runs use generator difficulty 1 with no stage deadline.
- Timed Brain begins on normal run 11; difficulty then unlocks gradually at runs 21, 31, 40 and 50.
- Normal Brain difficulty no longer jumps within a single run.
- Speed-native Brain experiences are held out of automatic selection during the learning phase.
- Level numbers are no longer exposed in the in-run Brain header; run 11 gets a one-time "Now the clock matters" transition.
- Untimed learning runs no longer fabricate a Speed telemetry value or weight it in the run score.
# BETWEEN v5.0.0

## Release candidate
- Expanded content library to 600 experiences across all eight modes.
- General tactile sound system with opt-in setting and distinct result sounds.
- Pass the Phone supports 5/10/15/20 question rounds.
- Install nudge appears contextually after several experiences when the browser exposes a real install prompt.
- Installed PWAs no longer show an Install action.
- Brain expanded with explicit game types including memory reverse, change detection and rule switching.
- Version identifiers separated for app/content/storage/cache.
- Preserved local-first, offline-first, no-account architecture.

## V5 Phase 2C — New Brain
- Replaced the temporary 60-record Brain library with 20 player-facing Brain experiences backed by procedural engines.
- Added seeded generation for reproducible Daily/debug/testing runs.
- Added adaptive stage difficulty for normal Brain runs and fixed seeded difficulty for Daily Brain.
- Added Brain run telemetry and five game-only dimensions: Accuracy, Speed, Memory, Switching, Consistency.
- Added local Brain run history, backup/import support, Profile Brain summary, and Daily Brain.
- Added stale-stage/timer cancellation guards, stage deadlines, leave/navigation cancellation, and generator validation.
- Archived Majority remains stored but is excluded from playable-library completion and Daily/Surprise Me selection.
- Normal content remains a complete replacement: 624 active non-Brain experiences (150 Pick One, 99 Knowledge after removing source #25, 75 Scenario, 100 Estimation, 100 Prediction, 100 Random) plus 100 archived Majority records.



## V5 Phase 3 — Final Engineering Audit

- Added the release-oriented `phase3:audit` command and `docs/PHASE3_FINAL_ENGINEERING_AUDIT.json`.
- Re-verified the V5 content contract: 150 Pick One, 99 Knowledge (source #25 removed), 75 Scenario, 100 Estimation, 100 Prediction, 100 Random, 100 archived Majority, and 20 procedural Brain experiences.
- Re-ran Phase 2C Brain and Phase 2D adversarial gates from the release tree.
- Simulated storage schema v5, prediction/Brain history persistence, backup validation, Brain history caps, and malformed-backup rejection.
- Re-checked script references, service-worker precache/cache version alignment, manifest, Netlify config, dynamic HTML boundaries, URL/pack validation, and reduced-motion timing separation.
- Confirmed the non-developer Phase 4 tester checklist names all 20 Brain experiences and records the future physical-device/browser checks without claiming those checks were performed here.
- Result: PASS. No machine-detectable release blockers found.

### 5.0.0 RC fix 1 — mode renderer dispatch
- Restored the explicit `RENDERERS` dispatch table in `js/modes.js` so Pick One, Knowledge, Scenario, Estimation, Prediction, Random, Majority, and Brain can enter their intended renderer.
- Bumped the PWA cache name to `between-v5.0.0-phase3fix1` so redeploys cannot retain the broken renderer file from the previous cache.
