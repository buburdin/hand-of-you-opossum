---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, performance, bundle-size]
dependencies: []
---

# Dynamic Import html-to-image

## Problem Statement
`FontExport.tsx` statically imports `html-to-image`, adding it to the main bundle even though it's only used when the user clicks export. Should be dynamically imported.

## Findings
- **File**: `frontend/components/FontExport.tsx`
- `import { toPng } from 'html-to-image'` at top level
- Only used in click handler
- `pixelRatio: 4` is also excessive (2 is sufficient for retina)

## Proposed Solutions

### Solution: Dynamic import on click
```typescript
const handleExport = async () => {
  const { toPng } = await import('html-to-image');
  // ...
};
```

- **Effort**: Small (5 min)
- **Risk**: None

## Acceptance Criteria
- [ ] html-to-image loaded only when needed
- [ ] Export still works correctly

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
