# BETWEEN V5 FIX3

## Brain completion crash fix

### User-facing symptom
A Brain run could play normally through its stages, then show the generic “Something went sideways” error instead of the Brain completion screen. The same failure also appeared when Brain was reached through Surprise Me.

### Root cause
`js/brain/engine.js` was calling `nextButtonHTML()` and `bindNext()`, which are private helper functions inside the `Modes` module and are not available in the `BrainEngine` module. The undefined function reference surfaced only when a Brain run completed.

### Fix
BrainEngine now owns its own completion UI helpers (`brainNextButtonHTML` and `bindBrainNext`) and no longer depends on private `Modes` helpers.

### Regression protection
Phase 2D now includes a runtime completion-callback test that executes the Brain completion path and verifies it does not throw.

### Cache
PWA cache bumped to `between-v5.0.0-phase3fix3`.
