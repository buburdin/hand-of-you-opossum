---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, quality, dead-code]
dependencies: []
---

# Remove ~230 Lines Dead Code in segment.ts

## Problem Statement
Most of `segment.ts` is dead code — the Vision API approach replaced the original segmentation logic. Only `CharBitmap` type and `extractSingleGlyph()` are still imported elsewhere.

## Findings
- **File**: `frontend/lib/pipeline/segment.ts`
- Dead functions: `segmentCharacters()`, `findBoundingBoxes()`, `findConnectedComponents()`, `mergeCloseBoxes()`, `assignCharacters()`
- Only `CharBitmap` interface and `extractSingleGlyph()` are imported
- ~230 lines of removable code

## Proposed Solutions

### Solution: Keep only used exports, remove the rest
- **Effort**: Small (10 min)
- **Risk**: None (dead code)

## Acceptance Criteria
- [ ] Only `CharBitmap` and `extractSingleGlyph()` remain
- [ ] No import errors after removal
- [ ] Build passes

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
