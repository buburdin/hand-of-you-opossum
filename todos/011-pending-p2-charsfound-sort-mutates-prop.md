---
status: resolved
priority: p2
issue_id: "011"
tags: [code-review, quality, typescript]
dependencies: []
---

# charsFound.sort() Mutates Prop Array

## Problem Statement

In `FontExport.tsx` line 65, `charsFound.sort().join(" ")` mutates the prop array in place, violating React's immutability contract. This can cause the parent's `charsFound` state to get reordered on every render.

## Findings

- **Source agents:** kieran-typescript-reviewer
- **File:** `frontend/components/FontExport.tsx` (line 65)

## Fix

```typescript
{[...charsFound].sort().join(" ")}
```

- **Effort:** Trivial (1 minute)
- **Risk:** None

## Acceptance Criteria

- [ ] `charsFound` prop is not mutated
- [ ] Display still shows sorted characters

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
