---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, typescript]
dependencies: []
---

# Replace Non-Null Assertions with Discriminated Union in fontgen.ts

## Problem Statement
`PathCommand` interface uses optional fields with 16 non-null assertions (`!`) throughout `fontgen.ts`. This pattern is unsafe — a typo or logic error would crash at runtime instead of being caught at compile time.

## Findings
- **File**: `frontend/lib/pipeline/fontgen.ts`
- `PathCommand` has `x?, y?, x1?, y1?, x2?, y2?` all optional
- 16 non-null assertions: `cmd.x!`, `cmd.y!`, `cmd.x1!`, etc.
- Should be a discriminated union: `MoveCommand | LineCommand | CurveCommand | ...`

## Proposed Solutions

### Solution: Discriminated union type
```typescript
type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
  | { type: "Q"; x: number; y: number; x1: number; y1: number }
  | { type: "Z" };
```

- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria
- [ ] All non-null assertions removed from fontgen.ts
- [ ] Type system enforces correct field access per command type

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
