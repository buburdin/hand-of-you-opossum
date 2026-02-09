/**
 * Character segmentation from preprocessed handwriting images.
 * Port of backend/pipeline/segment.py to client-side JS.
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

// ─── connected-component bounding boxes ───────────────────────────────────────

/**
 * Find bounding boxes of connected components in a binary image (8-connectivity).
 * Returns bounding boxes larger than minSize in each dimension.
 */
export function findBoundingBoxes(
  binary: Uint8Array,
  w: number,
  h: number,
  minSize = 5,
): BBox[] {
  const labels = new Int32Array(w * h);
  labels.fill(-1);
  let nextLabel = 0;
  const bboxes: Map<number, BBox> = new Map();

  const stack: number[] = [];

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === 0 || labels[i] !== -1) continue;

    const label = nextLabel++;
    const bbox: BBox = { x: w, y: h, w: 0, h: 0 };
    let xMax = 0;
    let yMax = 0;

    stack.push(i);
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (labels[idx] !== -1) continue;
      if (binary[idx] === 0) continue;
      labels[idx] = label;

      const px = idx % w;
      const py = (idx - px) / w;
      if (px < bbox.x) bbox.x = px;
      if (py < bbox.y) bbox.y = py;
      if (px > xMax) xMax = px;
      if (py > yMax) yMax = py;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const ni = ny * w + nx;
          if (labels[ni] === -1 && binary[ni] === 255) stack.push(ni);
        }
      }
    }

    bbox.w = xMax - bbox.x + 1;
    bbox.h = yMax - bbox.y + 1;
    if (bbox.w >= minSize && bbox.h >= minSize) {
      bboxes.set(label, bbox);
    }
  }

  return Array.from(bboxes.values());
}

// ─── merge close bounding boxes ───────────────────────────────────────────────

/**
 * Merge vertically-close small components into their parent (handles i/j dots).
 */
export function mergeCloseBBoxes(boxes: BBox[]): BBox[] {
  if (boxes.length === 0) return [];

  const heights = boxes.map((b) => b.h);
  heights.sort((a, b) => a - b);
  const medianH = heights[heights.length >> 1];

  const used = new Set<number>();
  const merged: BBox[] = [];

  // Sort by y position
  const indexed = boxes.map((b, i) => ({ b, i }));
  indexed.sort((a, b) => a.b.y - b.b.y);

  for (const { b: box, i } of indexed) {
    if (used.has(i)) continue;

    const isSmall = box.h < medianH * 0.4 && box.w < medianH * 0.4;

    if (isSmall) {
      // Try to find a parent character below
      let bestParent = -1;
      let bestDist = Infinity;

      for (const { b: other, i: j } of indexed) {
        if (j === i || used.has(j)) continue;
        // Parent should be below and horizontally overlapping
        const boxCenterX = box.x + box.w / 2;
        const otherCenterX = other.x + other.w / 2;
        if (other.y > box.y && Math.abs(boxCenterX - otherCenterX) < other.w) {
          const dist = other.y - (box.y + box.h);
          if (dist < medianH * 0.8 && dist < bestDist) {
            bestDist = dist;
            bestParent = j;
          }
        }
      }

      if (bestParent !== -1) {
        const parent = boxes[bestParent];
        const mx = Math.min(box.x, parent.x);
        const my = Math.min(box.y, parent.y);
        const mx2 = Math.max(box.x + box.w, parent.x + parent.w);
        const my2 = Math.max(box.y + box.h, parent.y + parent.h);
        merged.push({ x: mx, y: my, w: mx2 - mx, h: my2 - my });
        used.add(i);
        used.add(bestParent);
        continue;
      }
    }

    if (!used.has(i)) {
      merged.push(box);
      used.add(i);
    }
  }

  return merged;
}

// ─── reading order sort ───────────────────────────────────────────────────────

/**
 * Sort bounding boxes in reading order:
 * top-to-bottom by line, left-to-right within each line.
 */
export function sortReadingOrder(boxes: BBox[]): BBox[] {
  if (boxes.length === 0) return [];

  const heights = boxes.map((b) => b.h);
  heights.sort((a, b) => a - b);
  const medianH = heights[heights.length >> 1];
  const lineThreshold = medianH * 0.5;

  const sortedByY = [...boxes].sort((a, b) => a.y - b.y);

  const lines: BBox[][] = [];
  let currentLine: BBox[] = [sortedByY[0]];
  let currentY = sortedByY[0].y;

  for (let i = 1; i < sortedByY.length; i++) {
    if (Math.abs(sortedByY[i].y - currentY) < lineThreshold) {
      currentLine.push(sortedByY[i]);
    } else {
      lines.push(currentLine);
      currentLine = [sortedByY[i]];
      currentY = sortedByY[i].y;
    }
  }
  lines.push(currentLine);

  const result: BBox[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    result.push(...line);
  }
  return result;
}

// ─── crop character from binary image ─────────────────────────────────────────

/**
 * Crop a character from the binary image, with padding.
 */
function cropCharacter(
  binary: Uint8Array,
  imgW: number,
  imgH: number,
  bbox: BBox,
  pad = 4,
): { binary: Uint8Array; width: number; height: number } {
  const y1 = Math.max(0, bbox.y - pad);
  const y2 = Math.min(imgH, bbox.y + bbox.h + pad);
  const x1 = Math.max(0, bbox.x - pad);
  const x2 = Math.min(imgW, bbox.x + bbox.w + pad);

  const cw = x2 - x1;
  const ch = y2 - y1;
  const cropped = new Uint8Array(cw * ch);

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      cropped[y * cw + x] = binary[(y1 + y) * imgW + (x1 + x)];
    }
  }

  return { binary: cropped, width: cw, height: ch };
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

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Segment characters from a preprocessed binary image and map to pangram.
 *
 * @param binary  Binary image (white chars on black bg)
 * @param w       Image width
 * @param h       Image height
 * @param pangram The known pangram text the user wrote
 * @returns Array of character bitmaps mapped to pangram letters
 */
export function segmentCharacters(
  binary: Uint8Array,
  w: number,
  h: number,
  pangram: string,
): CharBitmap[] {
  let bboxes = findBoundingBoxes(binary, w, h);

  if (bboxes.length === 0) {
    throw new Error("No characters found in image");
  }

  bboxes = mergeCloseBBoxes(bboxes);
  bboxes = sortReadingOrder(bboxes);

  // Extract only alphabetic characters from the pangram (in order)
  const pangramChars: string[] = [];
  for (const c of pangram.toLowerCase()) {
    if (/[a-z]/.test(c)) pangramChars.push(c);
  }

  const results: CharBitmap[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < bboxes.length && i < pangramChars.length; i++) {
    const char = pangramChars[i];

    // Only keep first occurrence of each character
    if (seen.has(char)) continue;
    seen.add(char);

    const cropped = cropCharacter(binary, w, h, bboxes[i]);
    results.push({ char, ...cropped });
  }

  return results;
}
