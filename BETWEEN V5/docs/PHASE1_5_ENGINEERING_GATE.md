# BETWEEN V5 — Phase 1.5 Engineering Gate

Generated: 2026-10-02T09:33:27.612Z

## Decision

**PASS — no automated engineering blockers found.**

Phase 1.5 intentionally does **not** integrate the new Phase 2 content. It locks the expected content volume, proves the current Phase 1 baseline, and exercises static/data/behavioral safeguards before replacement begins.

## Phase 2 content volume locked

| Area | Expected |
|---|---:|
| pick_one | 150 |
| knowledge | 99 |
| scenario | 75 |
| estimation | 100 |
| prediction | 100 |
| random | 100 |
| Normal-mode total | **624** |
| Archived Majority source | 100 |
| Brain player-facing experiences | 20 |

**Important source finding:** Knowledge contains 100 numbered entries, but Knowledge #25 is explicitly marked `Verdict: REMOVE from the final library.` Therefore the Phase 2 Knowledge target is **99**, not 100.

## Current Phase 1 baseline

- App version: 5.0.0
- Embedded content version: 2.0
- Embedded items: 623
- Phase 1 checkpoint SHA-256: a940949ec9d9723375c15b72b709ef8874b8b7a1cd942a24f2169e0a7a61a124
- Current data.js SHA-256: 6c928d87f968fed22bd931688cbbfe8915c4eb5f1cdfd4c7b0c1103e92b3a2df

| Area | Current Phase 1 | Phase 2 target |
|---|---:|---:|
| pick_one | 149 | 150 |
| knowledge | 134 | 99 |
| scenario | 65 | 75 |
| estimation | 57 | 100 |
| prediction | 53 | 100 |
| random | 45 | 100 |
| brain static records | 60 | 20 player-facing experiences |
| majority archive | 60 | 100 source entries |

## Automated results

- **PASS** source:pick_one:sequential-numbering — 150 numbered entries
- **PASS** source:knowledge:sequential-numbering — 100 numbered entries
- **PASS** source:scenario:sequential-numbering — 75 numbered entries
- **PASS** source:majority:sequential-numbering — 100 numbered entries
- **PASS** source:estimation:sequential-numbering — 100 numbered entries
- **PASS** source:prediction:sequential-numbering — 100 numbered entries
- **PASS** source:random:sequential-numbering — 100 numbered entries
- **PASS** source:knowledge:explicit-removals — marked REMOVE: [25]
- **PASS** source:non-brain:sha256 — sha256=e7e5f485d64c3d10d819211ab3f037d7a2491551cee96840d602af363110c1c4
- **PASS** source:normal:counts — effective={"pick_one":150,"knowledge":99,"scenario":75,"majority":100,"estimation":100,"prediction":100,"random":100}
- **PASS** source:archived-majority:count — majority source=100
- **PASS** source:brain-experiences:sequential-numbering — 20 numbered entries
- **PASS** source:brain:sha256 — sha256=6baf8aa2262c8a589652476a47f472d989349d1cbc8941407356c2639d60d832
- **PASS** source:brain:experience-count — 20 player-facing experiences
- **PASS** baseline:app-version — app=5.0.0
- **PASS** baseline:data-file-present
- **PASS** data:json-parse — version=2.0 total=623
- **PASS** data:declared-total — declared=623 actual=623
- **PASS** data:mode-counts-match-declared — declared={"brain":60,"estimation":57,"knowledge":134,"majority":60,"pick_one":149,"prediction":53,"random":45,"scenario":65} actual={"pick_one":149,"knowledge":134,"scenario":65,"majority":60,"estimation":57,"prediction":53,"random":45,"brain":60}
- **PASS** data:duplicate-ids
- **PASS** data:duplicate-prompts
- **PASS** data:required-fields
- **PASS** data:mode-allowlist
- **PASS** data:structural-schema
- **PASS** data:baseline-counts — actual={"pick_one":149,"knowledge":134,"scenario":65,"majority":60,"estimation":57,"prediction":53,"random":45,"brain":60}
- **WARN** data:phase2-replacement-not-applied — Current Phase 1 dataset remains 623 items; Phase 2 target is 624 normal-mode records plus separate Brain experience definitions.
- **PASS** static:index-local-references
- **PASS** static:manifest-icons
- **PASS** static:manifest-standalone
- **PASS** static:manifest-scope
- **PASS** static:cache-version-consistency — between-v5.0.0-phase1 vs between-v5.0.0-phase1
- **PASS** static:service-worker-precache-unique
- **PASS** static:service-worker-precache-existing
- **PASS** static:service-worker-syntax
- **PASS** static:javascript-syntax
- **PASS** static:netlify-publish
- **PASS** static:security-headers
- **PASS** static:csp-no-eval
- **PASS** security:no-eval-newfunction-documentwrite
- **PASS** security:user-controlled-html-helpers-present
- **PASS** security:csp-connect-src-self
- **PASS** security:dynamic-html-review — all interpolation sinks are escaped or classified internal/static
- **PASS** security:storage-id-html-attributes-escaped
- **PASS** behavior:all-active-modes-nonempty — {"pick_one":149,"knowledge":134,"scenario":65,"estimation":57,"prediction":53,"random":45,"brain":60}
- **PASS** behavior:mode-selection
- **PASS** behavior:surprise-excludes-archived-majority
- **PASS** behavior:daily-deterministic-same-session — between_0264|between_0403|between_0560
- **PASS** behavior:answered-id-dedup — first=true second=false
- **PASS** behavior:seen-and-recent-progress-updates — seen=401 recent=15
- **PASS** behavior:recent-state-capped — recent=15/4/5/4
- **PASS** behavior:corrupt-progress-recovery
- **PASS** behavior:pack-import-shape-sanitized

### Totals: 52 passed, 1 warnings, 0 failures

## Explicit limitations

- This environment could run JavaScript syntax and headless runtime simulations, but the Chromium page-level UI harness was not reliable enough to certify real interactive browser behavior.
- Physical Android/PWA/offline/device testing stays in Phase 4, by design.
- Content quality/correctness review is Phase 2; Phase 1.5 only locks volume/schema expectations and protects the engineering base.

## Phase 1.5 changes

- `tools/phase15-gate.mjs` — repeatable gate runner with static, data, security, and VM behavior checks.
- `tools/phase15-targets.json` — machine-readable Phase 2 content targets and Phase 1 provenance, including source hashes.
- `docs/PHASE1_5_ENGINEERING_GATE.md` / `.json` — generated gate report.
- `package.json` — adds the `npm run phase15:gate` developer command.
- `js/screens.js` — escapes local/storage-derived IDs at HTML attribute sinks found during the gate review. No content records were replaced.
