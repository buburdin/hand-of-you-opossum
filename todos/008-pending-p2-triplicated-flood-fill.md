---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, quality, patterns, performance]
dependencies: []
---

# Deduplicate Triplicated Flood-Fill Algorithm

## Problem Statement
The same 8-connectivity flood-fill algorithm is implemented 3 times across the pipeline. This violates DRY, increases maintenance burden, and one copy (in `preprocess.ts`) has a performance bug (duplicate pixel pushes).

## Findings
1. **`frontend/lib/pipeline/preprocess.ts`**: `removeSmallComponents()` — flood-fill with known performance bug (pushes neighbors even if already visited)
2. **`frontend/lib/pipeline/segment.ts`**: `findBoundingBoxes()` — flood-fill (this file is mostly dead code)
3. **`frontend/lib/pipeline/index.ts`**: `labelFullImage()` — flood-fill for connected component labeling

## Proposed Solutions

### Solution A: Extract shared utility (Recommended)
Create a single `floodFill()` utility function in a shared module. All three call sites use it with different callbacks/accumulators.

- **Effort**: Medium
- **Risk**: Low

### Solution B: Delete dead code first, then deduplicate
Remove `segment.ts` dead code (see #016), then only 2 copies remain to unify.

- **Effort**: Small → Medium
- **Risk**: Low

## Acceptance Criteria
- [ ] Single flood-fill implementation used across all call sites
- [ ] Duplicate-push bug is fixed
- [ ] All existing functionality preserved

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
