/**
 * Connected component labeling for binary images.
 * Shared by the preprocessing (noise removal) and pipeline (character extraction) stages.
 */

// ─── types ───────────────────────────────────────────────────────────────────

export interface ComponentInfo {
  label: number;
  area: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface LabeledImage {
  labels: Int32Array;
  components: ComponentInfo[];
  width: number;
  height: number;
}

// ─── labeling ────────────────────────────────────────────────────────────────

/**
 * Label all connected components in a binary image (8-connectivity).
 * Components smaller than `minArea` are zeroed out in the label map.
 *
 * @param binary  Uint8Array where 255 = foreground (ink), 0 = background
 * @param w       Image width
 * @param h       Image height
 * @param minArea Minimum pixel count; smaller components get label -1
 */
export function labelFullImage(
  binary: Uint8Array,
  w: number,
  h: number,
  minArea = 10,
): LabeledImage {
  const labels = new Int32Array(w * h).fill(-1);
  let nextLabel = 0;
  const components: ComponentInfo[] = [];
  const stack: number[] = [];

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === 0 || labels[i] !== -1) continue;

    const label = nextLabel++;
    let area = 0;
    let minX = w, minY = h, maxX = 0, maxY = 0;

    stack.push(i);
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (labels[idx] !== -1 || binary[idx] === 0) continue;
      labels[idx] = label;
      area++;

      const px = idx % w;
      const py = (idx - px) / w;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;

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

    components.push({
      label,
      area,
      bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    });
  }

  // Zero out tiny noise components
  const filtered = components.filter((c) => c.area >= minArea);
  const validLabels = new Set(filtered.map((c) => c.label));
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] >= 0 && !validLabels.has(labels[i])) labels[i] = -1;
  }

  return { labels, components: filtered, width: w, height: h };
}
