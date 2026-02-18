---
status: resolved
priority: p2
issue_id: "007"
tags: [code-review, simplicity, quality]
dependencies: []
---

# Dead Code in segment.ts (~209 Lines)

## Problem Statement

Five functions in `segment.ts` are dead code in production: `segmentCharacters()`, `sortReadingOrder()`, `mergeCloseBBoxes()`, `cropCharacter()`, and `findBoundingBoxes()`. These represent the old position-based segmentation approach that was replaced by the Vision API path. They are only referenced by tests.

## Findings

- **Source agents:** code-simplicity-reviewer, architecture-strategist, kieran-typescript-reviewer
- **File:** `frontend/lib/pipeline/segment.ts` (lines 25-311)
- The only imports from `segment.ts` used in production are `extractSingleGlyph` and `CharBitmap` type
- No fallback mechanism exists in the UI to use the old segmentation path
- Tests are testing dead code, creating maintenance burden

## Proposed Solutions

### Option A: Remove Dead Code (Recommended)
Delete the 5 unused functions and their associated tests. Keep only `BBox`, `CharBitmap` types and `extractSingleGlyph`.
- **Effort:** Small (30 minutes)
- **Risk:** None (code is already unused)
- **LOC reduction:** ~209 lines + associated test lines

### Option B: Document as Intentional Fallback
Add comments explaining the code is retained for potential fallback use.
- **Effort:** Trivial
- **Risk:** Continued maintenance burden

## Acceptance Criteria

- [ ] Dead functions removed from segment.ts
- [ ] Associated dead tests removed
- [ ] Remaining exports still work correctly
- [ ] Build and existing tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | Identified by 3 independent agents |
