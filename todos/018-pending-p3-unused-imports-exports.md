---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, quality, typescript]
dependencies: []
---

# Unused Imports and Exports

## Problem Statement

Several unused imports and exports exist across the codebase.

## Findings

- **Source agents:** kieran-typescript-reviewer
- `frontend/lib/pipeline/debug.ts` line 9: `import type { BBox } from "./segment"` -- never used
- `frontend/lib/pangrams.ts` line 16: `getUniqueChars` exported but never imported anywhere
- Duplicate `Mode` type defined independently in both `page.tsx` (line 22) and `ModeSelector.tsx` (line 5)

## Fix

- Remove unused `BBox` import from debug.ts
- Remove or un-export `getUniqueChars` from pangrams.ts
- Export `Mode` type from one location and import in the other
- **Effort:** Trivial (10 minutes)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
