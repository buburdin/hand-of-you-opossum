---
status: resolved
priority: p1
issue_id: "004"
tags: [code-review, typescript, security]
dependencies: []
---

# Vision API Response Typed via Unsafe Cast / Unvalidated Passthrough

## Problem Statement

Two related issues with Vision API response handling:
1. In `vision.ts` line 123, `annotation as FullTextAnnotation` casts with zero runtime validation
2. In `route.ts` lines 135-136, raw `any` from `response.json()` is passed directly to the client

If the Vision API changes its response shape or returns an error, the app will crash deep in `extractRecognizedChars` with hard-to-debug errors.

## Findings

- **Source agents:** kieran-typescript-reviewer, security-sentinel
- **File:** `frontend/lib/pipeline/vision.ts` (line 123)
- **File:** `frontend/app/api/vision/route.ts` (lines 135-136)
- Google Vision API wraps errors inside the response body -- these are not caught
- The downstream code accesses deeply nested properties (`page.blocks[0].paragraphs[0].words[0].symbols`)

## Proposed Solutions

### Option A: Add Runtime Validation (Recommended)

**In `route.ts`** -- check for error field before forwarding:
```typescript
const data: unknown = await visionResponse.json();
if (data && typeof data === "object" && "error" in data) {
  return NextResponse.json({ error: "Vision API returned an error" }, { status: 502 });
}
return NextResponse.json(data);
```

**In `vision.ts`** -- validate before casting:
```typescript
if (!annotation || !Array.isArray(annotation.pages) || annotation.pages.length === 0) {
  throw new Error("Vision API returned an unexpected response format.");
}
return annotation as FullTextAnnotation;
```

- **Effort:** Small (30 minutes)
- **Risk:** None

## Acceptance Criteria

- [ ] API route checks for error responses from Google Vision
- [ ] Client-side code validates response shape before casting
- [ ] Invalid responses produce clear error messages for the user

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | Found by typescript-reviewer and security-sentinel |
| 2026-02-17 | Approved during triage | Status: pending -> ready. |
