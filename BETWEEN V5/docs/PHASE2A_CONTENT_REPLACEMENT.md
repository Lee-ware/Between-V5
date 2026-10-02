# BETWEEN — Phase 2A Content Replacement

## Status

**Phase:** 2A

**Result:** Content replacement completed; automated audit is recorded in `PHASE2A_CONTENT_AUDIT.json`.

This phase replaces the old normal-mode content. It does **not** merge old and new normal content.

## Source of truth

`content-sources/BETWEEN-non-brain-content.txt` is the authoritative source for Pick One, Knowledge, Scenario, Majority archive, Estimation, Prediction, and Random.

`content-sources/BETWEEN-Brain-content.txt` is included for provenance but its new Brain architecture is deliberately deferred to Phase 2C.

## Replacement targets

| Mode | Phase 2A result |
|---|---:|
| Pick One | 150 |
| Knowledge | 99 |
| Scenario | 75 |
| Majority archive | 100 |
| Estimation | 100 |
| Prediction | 100 |
| Random | 100 |
| Existing Brain temporarily preserved | 60 |

The app therefore contains **784 records at this intermediate checkpoint**: 624 replacement normal-mode records + 100 archived Majority records + the existing 60 Brain records awaiting Phase 2C.

## Knowledge #25

Knowledge item #25 is excluded from the shipped library because the source explicitly marks it for removal. The final Knowledge library therefore contains 99 records.

## Data-model decisions made during replacement

Estimation keeps the source's displayed answer text. Numeric ranges are stored as ranges rather than being converted into fake exact answers. Source answers without a numeric anchor remain text-only so the implementation does not invent precision.

Scenario records retain their source titles separately from the scenario text.

Knowledge records retain their explanations.

Prediction records retain a `resolution_condition` and any explicit `resolution_window` present in the source. Missing windows are not invented in this phase; they are recorded as a Phase 2B integration task.

Majority remains archived/inactive and is not added to the active `REAL_MODES` list.

## Replacement proof

New normal-mode records use new V5 content IDs. A manifest of the Phase 1 normal-mode IDs/content signatures is stored in `tools/phase15-old-normal-manifest.json`; the Phase 2A audit checks that none of those old normal records survived.

## Next phase

**Phase 2B — Content Integration QA.**

That phase is where the new data and the existing UI/engine behavior are tested together, including the numeric Prediction flow, Estimation ranges/text answers, Scenario titles, Knowledge explanations, and all special characters/long text cases.
