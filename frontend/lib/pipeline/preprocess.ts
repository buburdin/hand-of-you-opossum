/**
 * Image preprocessing for handwriting extraction.
 * Pure Canvas/ImageData implementation — no OpenCV needed.
 *
 * Ports the Python backend's preprocess.py to client-side JS.
 */

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Maximum dimension for preprocessing. Larger images are downscaled
 * to keep adaptive threshold block sizes effective and processing fast.
 * Phone cameras often produce 3000-4000px images; 1200px is a good balance.
 */
const MAX_PREPROCESS_DIM = 1200;

/** Load an image Blob/File into an ImageData via an off-screen canvas.
 *  Automatically downscales images larger than MAX_PREPROCESS_DIM. */
export async function loadImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  let { width, height } = bitmap;

  // Downscale large images proportionally
  const maxDim = Math.max(width, height);
  if (maxDim > MAX_PREPROCESS_DIM) {
    const scale = MAX_PREPROCESS_DIM / maxDim;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/** Convert RGBA ImageData to a single-channel grayscale Uint8Array. */
export function toGrayscale(image: ImageData): Uint8Array {
  const { data, width, height } = image;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // ITU-R BT.601 luma weights (same as OpenCV cvtColor BGR2GRAY)
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

// ─── blur ─────────────────────────────────────────────────────────────────────

/** Simple 5×5 box blur (approximates Gaussian, much faster). */
export function blur5x5(src: Uint8Array, w: number, h: number): Uint8Array {
  const dst = new Uint8Array(w * h);
  const r = 2; // radius
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          sum += src[ny * w + nx];
          count++;
        }
      }
      dst[y * w + x] = Math.round(sum / count);
    }
  }
  return dst;
}

// ─── threshold ────────────────────────────────────────────────────────────────

/**
 * Adaptive Gaussian-style threshold (block-mean approximation).
 * Mirrors cv2.adaptiveThreshold(... ADAPTIVE_THRESH_GAUSSIAN_C, BINARY_INV, 21, 10).
 *
 * For each pixel, compute the mean of a (blockSize × blockSize) neighbourhood,
 * subtract C, and threshold: pixel < (mean - C) → 255 (ink), else → 0.
 */
export function adaptiveThreshold(
  gray: Uint8Array,
  w: number,
  h: number,
  blockSize = 21,
  C = 10,
): Uint8Array {
  const out = new Uint8Array(w * h);
  const r = (blockSize - 1) >> 1;

  // Build integral image for fast mean computation
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] =
        rowSum + integral[y * (w + 1) + (x + 1)];
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const y1 = Math.max(0, y - r);
      const y2 = Math.min(h - 1, y + r);
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(w - 1, x + r);

      const area = (y2 - y1 + 1) * (x2 - x1 + 1);
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1];

      const mean = sum / area;
      // BINARY_INV: pixel darker than threshold → 255 (ink)
      out[y * w + x] = gray[y * w + x] < mean - C ? 255 : 0;
    }
  }
  return out;
}

/**
 * Otsu's automatic threshold (BINARY_INV).
 * Used for clean canvas drawings where lighting is uniform.
 */
export function otsuThreshold(gray: Uint8Array): { binary: Uint8Array; threshold: number } {
  // Build histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];

  let sumBg = 0;
  let wBg = 0;
  let maxVariance = 0;
  let bestT = 0;

  for (let t = 0; t < 256; t++) {
    wBg += hist[t];
    if (wBg === 0) continue;
    const wFg = total - wBg;
    if (wFg === 0) break;

    sumBg += t * hist[t];
    const meanBg = sumBg / wBg;
    const meanFg = (sumAll - sumBg) / wFg;
    const variance = wBg * wFg * (meanBg - meanFg) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      bestT = t;
    }
  }

  const binary = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    // BINARY_INV: darker than threshold → 255
    binary[i] = gray[i] <= bestT ? 255 : 0;
  }
  return { binary, threshold: bestT };
}

// ─── morphology ───────────────────────────────────────────────────────────────

/** Dilate binary image with a rect kernel of given size. */
export function dilate(
  src: Uint8Array,
  w: number,
  h: number,
  kw: number,
  kh: number,
): Uint8Array {
  const dst = new Uint8Array(w * h);
  const rx = (kw - 1) >> 1;
  const ry = (kh - 1) >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let max = 0;
      for (let dy = -ry; dy <= ry && max === 0; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -rx; dx <= rx; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          if (src[ny * w + nx] === 255) { max = 255; break; }
        }
      }
      dst[y * w + x] = max;
    }
  }
  return dst;
}

/** Erode binary image with a rect kernel of given size. */
export function erode(
  src: Uint8Array,
  w: number,
  h: number,
  kw: number,
  kh: number,
): Uint8Array {
  const dst = new Uint8Array(w * h);
  const rx = (kw - 1) >> 1;
  const ry = (kh - 1) >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let min = 255;
      for (let dy = -ry; dy <= ry && min === 255; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) { min = 0; break; }
        for (let dx = -rx; dx <= rx; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) { min = 0; break; }
          if (src[ny * w + nx] === 0) { min = 0; break; }
        }
      }
      dst[y * w + x] = min;
    }
  }
  return dst;
}

/** Morphological close = dilate then erode (fills small gaps). */
export function morphClose(
  src: Uint8Array,
  w: number,
  h: number,
  kw: number,
  kh: number,
): Uint8Array {
  return erode(dilate(src, w, h, kw, kh), w, h, kw, kh);
}

// ─── connected components ─────────────────────────────────────────────────────

/** Remove connected components smaller than minArea pixels. */
export function removeSmallComponents(
  binary: Uint8Array,
  w: number,
  h: number,
  minArea: number,
): Uint8Array {
  const labels = new Int32Array(w * h);
  labels.fill(-1);
  let nextLabel = 0;
  const areas: number[] = [];

  // Simple flood-fill labelling (8-connectivity)
  const stack: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === 0 || labels[i] !== -1) continue;
    const label = nextLabel++;
    let area = 0;
    stack.push(i);
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (labels[idx] !== -1) continue;
      if (binary[idx] === 0) continue;
      labels[idx] = label;
      area++;
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
          if (labels[ni] === -1 && binary[ni] === 255) stack.push(ni);
        }
      }
    }
    areas.push(area);
  }

  const out = new Uint8Array(w * h);
  for (let i = 0; i < binary.length; i++) {
    if (labels[i] >= 0 && areas[labels[i]] >= minArea) {
      out[i] = 255;
    }
  }
  return out;
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Preprocess a handwriting photo for character segmentation.
 * Returns a binary Uint8Array (0/255) with chars as white on black,
 * plus the image dimensions.
 */
export async function preprocessPhoto(
  blob: Blob,
): Promise<{ binary: Uint8Array; width: number; height: number }> {
  const image = await loadImageData(blob);
  const { width, height } = image;

  let gray = toGrayscale(image);
  gray = blur5x5(gray, width, height);
  let binary = adaptiveThreshold(gray, width, height, 21, 10);
  binary = morphClose(binary, width, height, 3, 3);
  binary = removeSmallComponents(binary, width, height, 50);

  return { binary, width, height };
}

/**
 * Preprocess a single canvas-drawn glyph.
 * Simpler pipeline — canvas drawings are already clean.
 */
export async function preprocessGlyph(
  blob: Blob,
): Promise<{ binary: Uint8Array; width: number; height: number }> {
  const image = await loadImageData(blob);
  const { width, height } = image;

  const gray = toGrayscale(image);
  let { binary } = otsuThreshold(gray);
  binary = morphClose(binary, width, height, 2, 2);

  return { binary, width, height };
}

/**
 * Convert a binary Uint8Array to ImageData for potrace.
 *
 * IMPORTANT: Our binary format is white-on-black (ink = 255, bg = 0).
 * Potrace traces BLACK regions, so we INVERT: ink → 0 (black), bg → 255 (white).
 * This ensures potrace traces the letter shapes, not the background.
 */
export function binaryToImageData(
  binary: Uint8Array,
  w: number,
  h: number,
): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < binary.length; i++) {
    // Invert: ink (255) → black (0), bg (0) → white (255)
    const v = 255 - binary[i];
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, w, h);
}
