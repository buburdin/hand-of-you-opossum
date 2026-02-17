---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, quality]
dependencies: []
---

# Console.log Statements Left in Production Code

## Problem Statement

Three `console.log` calls in pipeline code will appear in production users' browser consoles.

## Findings

- **Source agents:** pattern-recognition-specialist, kieran-typescript-reviewer
- `frontend/lib/pipeline/index.ts` lines 282-284 (logs component count)
- `frontend/lib/pipeline/index.ts` lines 317-319 (logs scale factors)
- `frontend/lib/pipeline/vision.ts` line 173 (logs page dimensions)

## Fix

Remove or gate behind the `collectDebug` flag.
- **Effort:** Trivial (5 minutes)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
