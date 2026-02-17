---
status: resolved
priority: p2
issue_id: "010"
tags: [code-review, performance, quality]
dependencies: []
---

# Debug Data Always Collected in Production

## Problem Statement

`page.tsx` line 59 hardcodes `collectDebug = true`, causing 4 synchronous PNG encodes via `canvas.toDataURL()` on every processing run -- even though the debug panel starts collapsed and most users never open it. This wastes 200-800ms on every processing cycle.

## Findings

- **Source agents:** performance-oracle, code-simplicity-reviewer
- **Files:** `frontend/app/page.tsx` (line 59), `frontend/lib/pipeline/debug.ts`
- 4 full-resolution PNG encodes per processing run
- Debug overlay is collapsed by default -- data is generated but never seen
- The entire debug module (263 lines) is statically imported

## Proposed Solutions

### Option A: Lazy Generation + Dynamic Import (Recommended)
1. Gate `collectDebug` behind a URL parameter or dev check
2. Dynamic-import the debug module: `const debugModule = await import("./debug")`
3. Store raw buffers; generate data URLs lazily when user opens debug panel
- **Effort:** Medium (2 hours)
- **Risk:** Low

### Option B: Gate Behind URL Parameter Only
Add `const debug = new URLSearchParams(window.location.search).has('debug')` and pass to pipeline.
- **Effort:** Small (15 minutes)
- **Risk:** None

## Acceptance Criteria

- [ ] Debug data is NOT collected by default in production
- [ ] Debug mode is accessible via URL parameter (e.g., `?debug`)
- [ ] Processing pipeline is 200-800ms faster without debug

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
