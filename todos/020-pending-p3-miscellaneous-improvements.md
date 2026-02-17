---
status: pending
priority: p3
issue_id: "020"
tags: [code-review, quality, performance]
dependencies: []
---

# Miscellaneous P3 Improvements

## Items

### Performance
- **Non-separable 5x5 box blur** (`preprocess.ts` lines 52-73): 25 reads/pixel instead of 2. Decompose into horizontal+vertical passes with running sum. ~200-400ms savings on mobile.
- **Float64Array for integral image** (`preprocess.ts` line 95): Uses 11.5MB when Int32Array (5.8MB) suffices. Change: `new Float64Array(...)` -> `new Int32Array(...)`.
- **Flood-fill stack duplicate pushes** (3 files): Pixels pushed up to 8x before labeling. Mark as labeled immediately when pushing. 10-30% speedup.
- **Full-image scan per character** (`index.ts` lines 184-196): Scans 1.44M pixels 26 times when bbox metadata exists. Use component metadata instead.
- **pixelRatio: 4 in image export** (`FontExport.tsx` line 78): Creates enormous PNGs on high-DPI. Cap at `Math.min(window.devicePixelRatio * 2, 4)` or just use 2.
- **html-to-image static import** (`FontExport.tsx`): Should be `await import("html-to-image")` since only used on button click.

### TypeScript / Quality
- **potraceFn uninitialized** (`vectorize.ts` line 12): Should be typed as `| null` and initialized to `null`.
- **Redundant type assertion** (`DrawCanvas.tsx` lines 87-91): `as React.MouseEvent` cast is redundant after `"touches" in e` narrowing.
- **clearCanvas missing from useEffect deps** (`DrawCanvas.tsx` lines 46-60): React exhaustive-deps lint would flag this.
- **Duplicate spring constants** (9+ occurrences across components): Extract to `lib/motion.ts`.
- **Duplicate handler bodies** (`page.tsx` lines 48-105): `handlePangramCapture` and `handleDrawComplete` have nearly identical structures.

### UX
- **ThemeToggle hydration mismatch** (`ThemeToggle.tsx`): Server renders "light" then hydrates with actual theme. Consider script-based theme detection.
- **userScalable: false** (`layout.tsx`): Harms accessibility. Consider removing.
- **handleFile triggers processing immediately** (`PangramCapture.tsx` lines 26-34): User sees preview but processing already started.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | Collected from all 6 review agents |
