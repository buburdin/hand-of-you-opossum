---
status: resolved
priority: p2
issue_id: "008"
tags: [code-review, performance, quality]
dependencies: []
---

# O(n^2) Base64 Encoding via String Concatenation

## Problem Statement

Base64 encoding in `vision.ts` and `fontLoader.ts` uses byte-by-byte `String.fromCharCode` concatenation, which is O(n^2) due to JavaScript's immutable string copying. For a 3MB photo, this causes 500-2000ms UI freeze on mobile.

## Findings

- **Source agents:** performance-oracle, architecture-strategist, kieran-typescript-reviewer
- **Files:**
  - `frontend/lib/pipeline/vision.ts` lines 91-97
  - `frontend/lib/fontLoader.ts` lines 11-16
- Same pattern in both files: `binaryStr += String.fromCharCode(bytes[i])`
- vision.ts processes large images (3-5MB), fontLoader.ts processes smaller font files (<100KB)
- For vision.ts, this is the biggest single performance bottleneck

## Proposed Solutions

### Option A: Chunked Conversion (Recommended)
```typescript
const chunks: string[] = [];
const CHUNK = 8192;
for (let i = 0; i < bytes.length; i += CHUNK) {
  chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
}
const binaryStr = chunks.join("");
```
- **Effort:** Small (15 minutes)
- **Risk:** None

### Option B: FileReader.readAsDataURL (for vision.ts blob)
Use the browser's built-in FileReader for the blob-to-base64 conversion in vision.ts.
- **Effort:** Small
- **Risk:** Low (async API change)

## Acceptance Criteria

- [ ] Base64 encoding no longer uses character-by-character concatenation
- [ ] Large images (3-5MB) encode without noticeable UI freeze
- [ ] Both vision.ts and fontLoader.ts patterns are fixed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | Identified by 3 agents as top performance issue |
