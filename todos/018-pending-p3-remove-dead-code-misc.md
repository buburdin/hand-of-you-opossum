---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, quality, dead-code]
dependencies: []
---

# Remove Miscellaneous Dead Code

## Problem Statement
Several small pieces of dead code identified across the codebase.

## Findings
- `frontend/lib/pangrams.ts`: `getUniqueChars()` is never imported anywhere
- `frontend/lib/pipeline/vectorize.ts`: `extractSvgViewBox()` (~20 lines) is dead code
- `frontend/lib/fontLoader.ts`: WOFF2 detection logic (app only produces TTF)
- `frontend/lib/pipeline/debug.ts`: `import type { BBox }` is unused

## Proposed Solutions

### Solution: Delete all identified dead code
- **Effort**: Small (10 min)
- **Risk**: None

## Acceptance Criteria
- [ ] All dead code removed
- [ ] Build passes
- [ ] No import errors

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
