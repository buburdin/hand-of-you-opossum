---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, quality, react]
dependencies: []
---

# Fix Props Mutation: charsFound.sort()

## Problem Statement
`FontExport.tsx` calls `.sort()` on the `charsFound` prop, which mutates the parent's array in place. In React, props should be treated as immutable.

## Findings
- **File**: `frontend/components/FontExport.tsx`, line 64
- `charsFound.sort()` mutates the prop array
- Should use `[...charsFound].sort()` or `charsFound.toSorted()`

## Proposed Solutions

### Solution: Use spread + sort
Replace `charsFound.sort()` with `[...charsFound].sort()`.

- **Effort**: Small (1 min)
- **Risk**: None

## Acceptance Criteria
- [ ] Props are not mutated

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
