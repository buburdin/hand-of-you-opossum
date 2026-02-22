---
date: 2026-02-22
topic: smooth-drawing
---

# Smooth Drawing Strokes in DrawCanvas

## What We're Building

Replace the current raw `lineTo()` drawing in `DrawCanvas.tsx` with quadratic Bezier curve interpolation through midpoints. This will transform the jagged, angular strokes into clean, precise curves that feel natural and vector-like.

## Current Problem

The `draw()` handler calls `ctx.lineTo(x, y)` for every `mousemove` event, creating straight-line segments between consecutive points. Fast or curved movements produce visible angles and jagged strokes instead of smooth curves.

## Why This Approach

**Chosen: Quadratic Bezier Through Midpoints**

For every new point, instead of drawing a straight line, we draw a `quadraticCurveTo()` where:
- The control point is the previous actual mouse position
- The endpoint is the midpoint between the previous and current mouse positions

This produces seamless C1-continuous curves with no visible corners.

**Alternatives considered:**
- **Cubic Bezier / Catmull-Rom** — Smoother but adds look-ahead latency and more complexity. Overkill for this use case.
- **Point thinning + Bezier** — Adds a distance threshold layer. Useful for jitter reduction but can feel laggy at slow speeds.

## Key Decisions

- **Quadratic Bezier through midpoints**: Industry standard (Excalidraw, tldraw, Figma freehand). Best balance of smoothness, performance, and simplicity.
- **Mobile performance priority**: This approach has near-zero computational overhead — just one `quadraticCurveTo()` per mouse event instead of `lineTo()`.
- **No path history needed**: Strokes are still rendered directly to canvas; no need to store point arrays for this approach.

## Open Questions

- Should we also add a minimum distance threshold to filter micro-jitter? (Can be added later if needed.)

## Next Steps

→ `/workflows:plan` for implementation details
