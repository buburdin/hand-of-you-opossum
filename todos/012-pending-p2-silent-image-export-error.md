---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, quality, architecture]
dependencies: []
---

# Silent Error Handling in Image Export

## Problem Statement

`exportElementAsImage` in `FontExport.tsx` catches errors with only `console.error`. If `html-to-image` fails (Safari cross-origin issues, large elements, memory pressure), the user sees nothing happen -- no feedback at all.

## Findings

- **Source agents:** architecture-strategist, pattern-recognition-specialist
- **File:** `frontend/components/FontExport.tsx` (lines 74-98)

## Proposed Solutions

### Fix: Propagate Error to UI (Recommended)
Either throw the error to be caught by the caller in `page.tsx`, or accept an error callback.
- **Effort:** Small (15 minutes)
- **Risk:** None

## Acceptance Criteria

- [ ] Failed image export shows a user-visible error message
- [ ] Error message is helpful (e.g., "Failed to export image. Try again.")

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
