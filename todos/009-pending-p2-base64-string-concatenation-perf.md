---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, performance]
dependencies: []
---

# Fix O(n^2) Base64 Encoding via String Concatenation

## Problem Statement
`arrayBufferToBase64()` in `vision.ts` builds a string character-by-character using `+=` in a loop, which is O(n^2) for large images. For a 5MB image, this creates ~5 million intermediate strings.

## Findings
- **File**: `frontend/lib/pipeline/vision.ts`, lines 91-97
- Uses `String.fromCharCode()` in a loop with string concatenation
- Should use `btoa()` or chunk-based approach

## Proposed Solutions

### Solution: Use btoa with chunked processing
```typescript
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
```

- **Effort**: Small (5 min)
- **Risk**: None

## Acceptance Criteria
- [ ] Base64 encoding uses chunked approach
- [ ] Performance improved for large images

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
