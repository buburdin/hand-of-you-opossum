import { describe, it, expect } from "vitest";
import {
  findBoundingBoxes,
  mergeCloseBBoxes,
  sortReadingOrder,
  extractSingleGlyph,
  segmentCharacters,
} from "@/lib/pipeline/segment";

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

describe("findBoundingBoxes", () => {
  it("finds a single rectangle", () => {
    const binary = makeImageWithRects(100, 100, [
      { x: 10, y: 20, rw: 30, rh: 40 },
    ]);
    const boxes = findBoundingBoxes(binary, 100, 100);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].x).toBe(10);
    expect(boxes[0].y).toBe(20);
    expect(boxes[0].w).toBe(30);
    expect(boxes[0].h).toBe(40);
  });

  it("finds multiple separated rectangles", () => {
    const binary = makeImageWithRects(200, 100, [
      { x: 10, y: 10, rw: 20, rh: 30 },
      { x: 80, y: 10, rw: 20, rh: 30 },
      { x: 150, y: 10, rw: 20, rh: 30 },
    ]);
    const boxes = findBoundingBoxes(binary, 200, 100);
    expect(boxes).toHaveLength(3);
  });

  it("filters out tiny noise (< minSize)", () => {
    const binary = makeImageWithRects(100, 100, [
      { x: 10, y: 10, rw: 3, rh: 3 }, // too small (< 5)
      { x: 50, y: 50, rw: 20, rh: 20 }, // large enough
    ]);
    const boxes = findBoundingBoxes(binary, 100, 100);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].x).toBe(50);
  });

  it("returns empty array for empty image", () => {
    const binary = new Uint8Array(100).fill(0);
    const boxes = findBoundingBoxes(binary, 10, 10);
    expect(boxes).toHaveLength(0);
  });
});

describe("mergeCloseBBoxes", () => {
  it("merges a small dot above a larger character (like i/j)", () => {
    const boxes = [
      { x: 50, y: 10, w: 8, h: 8 }, // dot
      { x: 45, y: 40, w: 20, h: 60 }, // stem
    ];
    const merged = mergeCloseBBoxes(boxes);
    expect(merged).toHaveLength(1);
    // Merged box should encompass both
    expect(merged[0].y).toBe(10);
    expect(merged[0].h).toBeGreaterThanOrEqual(90); // from y=10 to y=100
  });

  it("does not merge distant components", () => {
    const boxes = [
      { x: 10, y: 10, w: 30, h: 40 },
      { x: 80, y: 10, w: 30, h: 40 },
    ];
    const merged = mergeCloseBBoxes(boxes);
    expect(merged).toHaveLength(2);
  });
});

describe("sortReadingOrder", () => {
  it("sorts left-to-right within a single line", () => {
    const boxes = [
      { x: 80, y: 10, w: 20, h: 30 },
      { x: 10, y: 10, w: 20, h: 30 },
      { x: 45, y: 10, w: 20, h: 30 },
    ];
    const sorted = sortReadingOrder(boxes);
    expect(sorted[0].x).toBe(10);
    expect(sorted[1].x).toBe(45);
    expect(sorted[2].x).toBe(80);
  });

  it("sorts top-to-bottom across lines, then left-to-right", () => {
    const boxes = [
      { x: 50, y: 100, w: 20, h: 30 }, // line 2, right
      { x: 10, y: 100, w: 20, h: 30 }, // line 2, left
      { x: 10, y: 10, w: 20, h: 30 }, // line 1, left
      { x: 50, y: 10, w: 20, h: 30 }, // line 1, right
    ];
    const sorted = sortReadingOrder(boxes);
    // Line 1: x=10, x=50
    expect(sorted[0].x).toBe(10);
    expect(sorted[0].y).toBe(10);
    expect(sorted[1].x).toBe(50);
    expect(sorted[1].y).toBe(10);
    // Line 2: x=10, x=50
    expect(sorted[2].x).toBe(10);
    expect(sorted[2].y).toBe(100);
    expect(sorted[3].x).toBe(50);
    expect(sorted[3].y).toBe(100);
  });
});

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

describe("segmentCharacters", () => {
  it("segments and maps characters to pangram", () => {
    // Three well-separated characters
    const binary = makeImageWithRects(300, 100, [
      { x: 10, y: 10, rw: 20, rh: 30 },
      { x: 80, y: 10, rw: 20, rh: 30 },
      { x: 150, y: 10, rw: 20, rh: 30 },
    ]);

    const result = segmentCharacters(binary, 300, 100, "abc");
    expect(result).toHaveLength(3);
    expect(result[0].char).toBe("a");
    expect(result[1].char).toBe("b");
    expect(result[2].char).toBe("c");
  });

  it("only keeps first occurrence of duplicate characters", () => {
    const binary = makeImageWithRects(400, 100, [
      { x: 10, y: 10, rw: 20, rh: 30 },
      { x: 80, y: 10, rw: 20, rh: 30 },
      { x: 150, y: 10, rw: 20, rh: 30 },
      { x: 220, y: 10, rw: 20, rh: 30 },
    ]);

    const result = segmentCharacters(binary, 400, 100, "abba");
    // 'a' and 'b' should appear only once each
    const chars = result.map((r) => r.char);
    expect(chars).toContain("a");
    expect(chars).toContain("b");
    expect(chars.filter((c) => c === "a")).toHaveLength(1);
  });

  it("ignores non-alpha characters in pangram", () => {
    const binary = makeImageWithRects(200, 100, [
      { x: 10, y: 10, rw: 20, rh: 30 },
      { x: 80, y: 10, rw: 20, rh: 30 },
    ]);

    const result = segmentCharacters(binary, 200, 100, "a, b!");
    expect(result).toHaveLength(2);
    expect(result[0].char).toBe("a");
    expect(result[1].char).toBe("b");
  });

  it("throws when no characters found", () => {
    const binary = new Uint8Array(100).fill(0);
    expect(() => segmentCharacters(binary, 10, 10, "abc")).toThrow(
      "No characters found",
    );
  });
});
