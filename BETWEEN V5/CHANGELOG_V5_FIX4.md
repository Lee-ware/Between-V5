# BETWEEN V5 FIX4

## Brain Memory Grid lifecycle fix

### User-facing symptom
An intermittent Brain Memory Grid state could remain on the memorization screen with highlighted cells still visible. The tiles appeared tappable but correctly ignored input because the challenge had not yet entered its answer phase. Leaving Brain and returning could clear the problem.

### Root cause / failure mode
Memory Grid depended on a single run-owned presentation timeout to transition from its initial highlighted state (`armed=false`) into its answer state (`armed=true`). The code had no lifecycle recovery path if that callback was not delivered cleanly after a browser/PWA lifecycle interruption.

### Fix
Memory Grid now has an idempotent presentation transition plus a small fallback timer and lifecycle recovery checks on visibility/page resume. The intended `displayTime` is unchanged. Learning runs remain untimed for answering; the memory presentation still disappears normally before input is accepted.

The recovery path is stage-scoped and checks the active run and stage token, so an old Brain stage cannot arm itself after navigation or stage completion.

### Regression protection
Existing Phase 2C, Phase 2D, Phase 2E, Brain progression, and Phase 3 audits all pass after the change. JavaScript syntax checks also pass.

### Cache
PWA cache bumped to `between-v5.0.0-phase3fix4`.
