---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, architecture, react]
dependencies: []
---

# Add React Error Boundaries

## Problem Statement
No Error Boundaries exist in the React component tree. If any component throws during rendering (e.g., font loading fails, canvas operations error), the entire app crashes with a white screen instead of showing a graceful error state.

## Findings
- **No ErrorBoundary component** found anywhere in the project
- Pipeline failures (vectorize, fontgen) can propagate as uncaught errors
- Canvas operations (`getContext("2d")!`) use non-null assertions that will throw on failure

## Proposed Solutions

### Solution: Add ErrorBoundary wrapper component
Create a simple error boundary that catches rendering errors and shows a retry button.

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria
- [ ] Error boundary wraps the main app content
- [ ] Pipeline failures show user-friendly error message
- [ ] User can retry after an error

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
