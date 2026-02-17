---
status: resolved
priority: p2
issue_id: "009"
tags: [code-review, typescript, quality]
dependencies: []
---

# PathCommand Should Be a Discriminated Union

## Problem Statement

`PathCommand` in `fontgen.ts` uses optional fields instead of a discriminated union, causing 18 non-null assertions (`!`) throughout the file. Each `cmd.x!`, `cmd.y!` is a potential `undefined` dereference.

## Findings

- **Source agents:** kieran-typescript-reviewer
- **File:** `frontend/lib/pipeline/fontgen.ts` (lines 17-25)
- 18 non-null assertions in the file are all caused by this type design
- The switch statements already discriminate on `cmd.type`, so narrowing would work automatically

## Proposed Solutions

### Fix: Discriminated Union (Recommended)
```typescript
type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
  | { type: "Q"; x: number; y: number; x1: number; y1: number }
  | { type: "Z" };
```
- **Effort:** Small (30 minutes)
- **Risk:** None (eliminates all 18 non-null assertions)

## Acceptance Criteria

- [ ] PathCommand is a discriminated union
- [ ] All 18 non-null assertions are removed
- [ ] TypeScript compiler catches invalid command construction

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
