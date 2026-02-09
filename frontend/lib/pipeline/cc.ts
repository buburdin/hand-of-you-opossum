/**
 * Shared connected-component labeling using 8-connectivity flood fill.
 * Used by both preprocess.ts (noise removal) and segment.ts (bounding boxes).
 */

export interface ComponentLabels {
  labels: Int32Array;
  count: number;
}

/**
 * Label connected components in a binary image using 8-connectivity flood fill.
 *
 * Pixels with value 0 are background, 255 are foreground.
 * Labels are 0-indexed. Background pixels have label -1.
 */
export function labelConnectedComponents(
  binary: Uint8Array,
  w: number,
  h: number,
): ComponentLabels {
  const labels = new Int32Array(w * h);
  labels.fill(-1);
  let nextLabel = 0;

  const stack: number[] = [];

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === 0 || labels[i] !== -1) continue;

    const label = nextLabel++;
    labels[i] = label;
    stack.push(i);

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % w;
      const y = (idx - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const ni = ny * w + nx;
          if (labels[ni] === -1 && binary[ni] === 255) {
            labels[ni] = label;
            stack.push(ni);
          }
        }
      }
    }
  }

  return { labels, count: nextLabel };
}
