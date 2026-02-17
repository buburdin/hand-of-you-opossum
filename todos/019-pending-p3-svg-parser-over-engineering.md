---
status: pending
priority: p3
issue_id: "019"
tags: [code-review, simplicity]
dependencies: []
---

# SVG Path Parser Handles 14 Command Types; Potrace Only Emits 4

## Problem Statement

`parseSvgPath()` in `fontgen.ts` handles M, m, L, l, H, h, V, v, C, c, Q, q, Z, z (14 types). Potrace only emits M, C, L, Z (absolute). The relative/shorthand/quadratic handling is YAGNI -- the comment even admits this.

## Findings

- **Source agents:** code-simplicity-reviewer
- **File:** `frontend/lib/pipeline/fontgen.ts` lines 32-166
- A parser handling only M, L, C, Z would be ~25 lines instead of ~134
- Q handling in transform and path converter can also be removed (~10 more lines)
- **Estimated LOC reduction:** ~119 lines

## Note

While this is YAGNI, the existing parser works correctly and is well-tested. This is a cleanup opportunity, not a bug. The robustness of handling relative commands has low cost beyond code size.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
