import { describe, it, expect } from "vitest";
import { extractSingleGlyph } from "@/lib/pipeline/segment";

/** Helper: create a binary image with rectangles at given positions. */
function makeImageWithRects(
  w: number,
  h: number,
  rects: Array<{ x: number; y: number; rw: number; rh: number }>,
): Uint8Array {
  const binary = new Uint8Array(w * h).fill(0);
  for (const { x, y, rw, rh } of rects) {
    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          binary[py * w + px] = 255;
        }
      }
    }
  }
  return binary;
}

describe("extractSingleGlyph", () => {
  it("centers a glyph in a square canvas with padding", () => {
    const w = 100,
      h = 100;
    // Small content in top-left
    const binary = makeImageWithRects(w, h, [
      { x: 5, y: 5, rw: 20, rh: 30 },
    ]);
    const result = extractSingleGlyph(binary, w, h);

    // Output should be square
    expect(result.width).toBe(result.height);
    // Size = max(20, 30) + 20 = 50
    expect(result.width).toBe(50);
  });

  it("returns original image when empty", () => {
    const binary = new Uint8Array(100).fill(0);
    const result = extractSingleGlyph(binary, 10, 10);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });
});
