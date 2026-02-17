---
status: ready
priority: p1
issue_id: "005"
tags: [code-review, typescript, quality]
dependencies: []
---

# Non-Null Assertion on canvas.toBlob Result

## Problem Statement

In `DrawCanvas.tsx` line 136, `canvas.toBlob` callback uses `resolve(b!)` where `b` can be `null` per the Web API spec. If `toBlob` fails (tainted canvas, memory pressure), this resolves the promise with `null` coerced to `Blob`, causing a silent downstream crash.

## Findings

- **Source agents:** kieran-typescript-reviewer, pattern-recognition-specialist
- **File:** `frontend/components/DrawCanvas.tsx` (line 136)

## Proposed Solutions

### Fix (Recommended)
```typescript
const blob = await new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(
    (b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to capture canvas as image"));
    },
    "image/png"
  );
});
```
- **Effort:** Trivial (2 minutes)
- **Risk:** None

## Acceptance Criteria

- [ ] `toBlob` null case is handled with a proper error
- [ ] Error is caught and displayed to the user

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
| 2026-02-17 | Approved during triage | Status: pending -> ready. |
