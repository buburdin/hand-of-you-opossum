---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, security, typescript]
dependencies: []
---

# Validate Vision API Response at Runtime

## Problem Statement
The Vision API response is cast to TypeScript interfaces without runtime validation. If Google changes the API response format or returns an error, the app will crash with cryptic errors instead of handling it gracefully. The `Vertex` interface claims `x: number; y: number` but the code uses `v.x ?? 0` — indicating the actual response may have `undefined` values.

## Findings
- **File**: `frontend/lib/pipeline/vision.ts`
- `Vertex` interface (line ~30): `{ x: number; y: number }` — but code uses nullish coalescing (`v.x ?? 0`), meaning actual values can be undefined
- Response from `/api/vision` is used directly without validation
- **File**: `frontend/app/api/vision/route.ts`
- Google API response is forwarded without schema validation
- Error responses from Google API may have different structure

## Proposed Solutions

### Solution A: Add runtime type guard (Recommended)
Add a validation function that checks the response shape before processing:
- Verify `responses` array exists
- Verify `fullTextAnnotation` exists
- Validate vertex coordinates are numbers
- Fix `Vertex` interface to `{ x?: number; y?: number }`

- **Pros**: Catches malformed responses, accurate types
- **Cons**: Small amount of validation code
- **Effort**: Small
- **Risk**: None

### Solution B: Use Zod schema validation
Define response schema with Zod for automatic parsing and validation.

- **Pros**: Thorough validation, good error messages
- **Cons**: Adds dependency
- **Effort**: Medium
- **Risk**: Low

## Technical Details
- **Affected files**: `frontend/lib/pipeline/vision.ts`, `frontend/app/api/vision/route.ts`

## Acceptance Criteria
- [ ] `Vertex` interface correctly reflects optional fields
- [ ] Vision API response is validated before processing
- [ ] Graceful error message if response format is unexpected
- [ ] Nullish coalescing usage matches type definitions

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
