---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security, quality, performance]
dependencies: []
---

# Turn Off Hardcoded Debug Mode

## Problem Statement
Debug mode is hardcoded to `true` in production code, causing:
- 4 full-resolution PNG data URLs generated on every font generation (massive memory/CPU waste)
- Debug images exposed to any user via browser DevTools
- Significant performance overhead on every pipeline run

## Findings
- **File**: `frontend/app/page.tsx`, line 59
- Code: `const result = await processPangramLocally(file, pangram, true);`
- Third argument `true` = debug mode always on
- Debug generates: binary image, bbox overlay, component map, char crops grid
- Each is a full-resolution PNG data URL (potentially megabytes each)
- Debug data structure defined in `frontend/lib/pipeline/debug.ts`

## Proposed Solutions

### Solution A: Default to false, use URL param for debugging (Recommended)
```typescript
const isDebug = new URL(window.location.href).searchParams.has('debug');
const result = await processPangramLocally(file, pangram, isDebug);
```

- **Pros**: Zero overhead in production, easy to enable for debugging
- **Cons**: None significant
- **Effort**: Small (5 min)
- **Risk**: None

### Solution B: Environment variable
Use `process.env.NEXT_PUBLIC_DEBUG_PIPELINE === 'true'`

- **Pros**: Build-time control
- **Cons**: Requires rebuild to toggle
- **Effort**: Small
- **Risk**: None

## Technical Details
- **Affected files**: `frontend/app/page.tsx` (line 59)
- **Performance impact**: Eliminates ~4 full-resolution PNG generations per run

## Acceptance Criteria
- [ ] Debug mode defaults to `false`
- [ ] Debug can be enabled via URL parameter or env var
- [ ] Normal font generation works without debug overhead
- [ ] Debug visualizations still work when explicitly enabled

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
