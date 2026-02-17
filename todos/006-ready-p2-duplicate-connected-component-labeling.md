---
status: ready
priority: p2
issue_id: "006"
tags: [code-review, architecture, performance, simplicity]
dependencies: []
---

# Connected Component Labeling Implemented 3 Times

## Problem Statement

The same 8-connectivity flood-fill connected component labeling algorithm is implemented three separate times across the pipeline with near-identical code. This is a DRY violation that creates maintenance risk and wastes CPU cycles (two passes run back-to-back on the same image).

## Findings

- **Source agents:** performance-oracle, architecture-strategist, code-simplicity-reviewer, pattern-recognition-specialist
- **Files:**
  - `frontend/lib/pipeline/preprocess.ts` lines 244-292 (`removeSmallComponents`)
  - `frontend/lib/pipeline/segment.ts` lines 25-81 (`findBoundingBoxes`) -- DEAD CODE
  - `frontend/lib/pipeline/index.ts` lines 55-115 (`labelFullImage`)
- All three use identical logic: Int32Array labels, fill(-1), stack-based flood fill
- `findBoundingBoxes` is dead code (used only by dead `segmentCharacters`)
- `removeSmallComponents` and `labelFullImage` run back-to-back in the pipeline

## Proposed Solutions

### Option A: Unify into Shared Module (Recommended)
1. Remove dead `findBoundingBoxes` (part of dead code cleanup)
2. Move `labelFullImage` to a shared `components.ts` module
3. Reimplement `removeSmallComponents` as a 6-line wrapper:
```typescript
function removeSmallComponents(binary, w, h, minArea) {
  const { labels } = labelFullImage(binary, w, h, minArea);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < labels.length; i++) if (labels[i] >= 0) out[i] = 255;
  return out;
}
```
- **Effort:** Medium (1-2 hours)
- **Risk:** Low (well-tested algorithm, just consolidating)
- **LOC reduction:** ~100 lines

## Acceptance Criteria

- [ ] Single shared implementation of connected component labeling
- [ ] `removeSmallComponents` is a thin wrapper
- [ ] Pipeline produces identical results (test with existing test suite)
- [ ] No duplicate flood-fill code remains

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | Identified by 4 independent review agents |
| 2026-02-17 | Approved during triage | Status: pending -> ready. |
