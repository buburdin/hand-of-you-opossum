---
status: resolved
priority: p1
issue_id: "003"
tags: [code-review, quality, typescript]
dependencies: []
---

# Interval Leak on Error Path in page.tsx

## Problem Statement

Both `handlePangramCapture` and `handleDrawComplete` in `page.tsx` create `setInterval` timers for processing step animation, but only clear them in the success path. If the async pipeline throws, the interval fires indefinitely, updating state on a potentially unmounted component.

## Findings

- **Source agents:** kieran-typescript-reviewer, performance-oracle, pattern-recognition-specialist
- **File:** `frontend/app/page.tsx` (lines 55-73, 85-103)
- `clearInterval(stepTimer)` is only called after `await processPangramLocally(...)` succeeds
- The `catch` block does NOT call `clearInterval(stepTimer)`
- The interval will continue firing until the page is fully unloaded

## Proposed Solutions

### Option A: Use `finally` block (Recommended)
Move `clearInterval(stepTimer)` into a `finally` block.
- **Effort:** Trivial (2 minutes)
- **Risk:** None

```typescript
const stepTimer = setInterval(() => {
  setProcessingStep((s) => Math.min(s + 1, 3));
}, 800);
try {
  const result = await processPangramLocally(file, pangram, true);
  // ... success handling
} catch (err) {
  setError(err instanceof Error ? err.message : "Something went wrong");
  setStep("input");
} finally {
  clearInterval(stepTimer);
}
```

## Acceptance Criteria

- [ ] `clearInterval` is called in both success and error paths
- [ ] No intervals leak when the pipeline throws an error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | Found by 3 independent review agents |
| 2026-02-17 | Approved during triage | Status: pending -> ready. Trivial fix with finally block. |
