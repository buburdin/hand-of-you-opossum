/**
 * Character segmentation from preprocessed handwriting images.
 */

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CharBitmap {
  char: string;
  binary: Uint8Array;
  width: number;
  height: number;
}

// ─── extract single glyph (draw mode) ────────────────────────────────────────

/**
 * Extract and center a single glyph from a binary image.
 * Crops to content and centers in a square canvas with padding.
 */
export function extractSingleGlyph(
  binary: Uint8Array,
  w: number,
  h: number,
): { binary: Uint8Array; width: number; height: number } {
  // Find content bounds
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x] === 255) {
        hasContent = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent) return { binary, width: w, height: h };

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  // Center in a square canvas with padding
  const size = Math.max(cw, ch) + 20;
  const canvas = new Uint8Array(size * size);
  const ox = (size - cw) >> 1;
  const oy = (size - ch) >> 1;

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      canvas[(oy + y) * size + (ox + x)] = binary[(minY + y) * w + (minX + x)];
    }
  }

  return { binary: canvas, width: size, height: size };
}
