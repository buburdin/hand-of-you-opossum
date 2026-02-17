---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, performance]
dependencies: []
---

# Sequential Vectorization Loop (26 Characters One-at-a-Time)

## Problem Statement

In `processPangramLocally` and `processDrawnGlyphsLocally`, 26 characters are vectorized one-at-a-time with `await` in a for-loop. Since each potrace call is independent, they could be scheduled concurrently with `Promise.all()` for potential 2-5x speedup.

## Findings

- **Source agents:** performance-oracle
- **File:** `frontend/lib/pipeline/index.ts` (lines 357-362)
- Each `vectorizeGlyph` call is an independent WASM operation
- The for-loop forces sequential execution

## Proposed Solutions

### Fix: Promise.all (Recommended)
```typescript
const entries = Object.entries(charBitmaps);
const results = await Promise.all(
  entries.map(async ([char, { binary, width, height }]) => {
    const vec = await vectorizeGlyph(binary, width, height);
    return vec ? [char, vec] as const : null;
  })
);
const glyphs: Record<string, VectorizedGlyph> = {};
for (const r of results) {
  if (r) glyphs[r[0]] = r[1];
}
```
- **Effort:** Small (15 minutes)
- **Risk:** Low (independent operations)

## Acceptance Criteria

- [ ] Vectorization uses `Promise.all` for concurrent execution
- [ ] All characters still vectorize correctly
- [ ] Measurable speedup on 26-character sets

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
