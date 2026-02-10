/**
 * Debug visualisation helpers for the font generation pipeline.
 *
 * Generates data-URL images showing intermediate pipeline stages so you
 * can see exactly what the binarization, component labeling, and
 * per-character cropping look like.
 */

import type { BBox } from "./segment";
import type { RecognizedChar } from "./vision";

// ─── binary image → data URL ──────────────────────────────────────────────────

/**
 * Render a binary Uint8Array (0/255) as a PNG data URL.
 * White pixels = ink, black = background.
 */
export function binaryToDataURL(
  binary: Uint8Array,
  w: number,
  h: number,
): string {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(w, h);
  for (let i = 0; i < binary.length; i++) {
    const v = binary[i];
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  // OffscreenCanvas doesn't have toDataURL — we convert via blob
  // But for sync usage we'll use a regular canvas approach
  return offscreenToDataURL(canvas, w, h);
}

/**
 * Render the binary image with Vision bounding boxes overlaid.
 * Green rectangles = Vision's detected character positions.
 * Red labels = recognized character text.
 */
export function binaryWithBBoxesToDataURL(
  binary: Uint8Array,
  w: number,
  h: number,
  bboxes: { char: string; x: number; y: number; w: number; h: number }[],
): string {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;

  // Draw binary image
  const imageData = ctx.createImageData(w, h);
  for (let i = 0; i < binary.length; i++) {
    const v = binary[i];
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  // Draw bounding boxes
  ctx.strokeStyle = "#00ff00";
  ctx.lineWidth = 2;
  ctx.font = `${Math.max(10, Math.round(h / 40))}px monospace`;
  ctx.fillStyle = "#ff3333";

  for (const b of bboxes) {
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillText(b.char, b.x + 2, b.y - 3);
  }

  return offscreenToDataURL(canvas, w, h);
}

/**
 * Render connected components as a colored label map.
 * Each component gets a distinct color.
 */
export function labeledImageToDataURL(
  labels: Int32Array,
  w: number,
  h: number,
  numComponents: number,
): string {
  // Generate distinct colors for each component
  const colors = new Array<[number, number, number]>(numComponents);
  for (let i = 0; i < numComponents; i++) {
    const hue = (i * 137.508) % 360; // golden angle for distinct hues
    const [r, g, b] = hslToRgb(hue / 360, 0.7, 0.55);
    colors[i] = [r, g, b];
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(w, h);

  for (let i = 0; i < labels.length; i++) {
    const lbl = labels[i];
    if (lbl >= 0 && lbl < numComponents) {
      const [r, g, b] = colors[lbl];
      imageData.data[i * 4] = r;
      imageData.data[i * 4 + 1] = g;
      imageData.data[i * 4 + 2] = b;
    } else {
      // Background = dark gray
      imageData.data[i * 4] = 30;
      imageData.data[i * 4 + 1] = 30;
      imageData.data[i * 4 + 2] = 30;
    }
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return offscreenToDataURL(canvas, w, h);
}

// ─── per-character crop grid ──────────────────────────────────────────────────

/**
 * Render all character crops in a grid, with the character label below each.
 * Returns a single composite data URL showing all extracted glyphs.
 */
export function charCropsToDataURL(
  chars: { char: string; binary: Uint8Array; width: number; height: number }[],
): string {
  if (chars.length === 0) return "";

  const cellPad = 8;
  const labelHeight = 16;
  const maxCellSize = 80;

  // Compute cell size based on the largest glyph
  const maxW = Math.min(maxCellSize, Math.max(...chars.map((c) => c.width)));
  const maxH = Math.min(maxCellSize, Math.max(...chars.map((c) => c.height)));
  const cellW = maxW + cellPad * 2;
  const cellH = maxH + cellPad * 2 + labelHeight;

  const cols = Math.min(chars.length, Math.max(1, Math.floor(800 / cellW)));
  const rows = Math.ceil(chars.length / cols);
  const totalW = cols * cellW;
  const totalH = rows * cellH;

  const canvas = new OffscreenCanvas(totalW, totalH);
  const ctx = canvas.getContext("2d")!;

  // Dark background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, totalW, totalH);

  ctx.font = "11px monospace";
  ctx.textAlign = "center";

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * cellW + cellPad;
    const oy = row * cellH + cellPad;

    // Draw the glyph bitmap
    const scale = Math.min(maxW / c.width, maxH / c.height, 1);
    const sw = Math.round(c.width * scale);
    const sh = Math.round(c.height * scale);
    const gx = ox + (maxW - sw) / 2;
    const gy = oy + (maxH - sh) / 2;

    // Create a tiny ImageData for this glyph
    const glyphCanvas = new OffscreenCanvas(c.width, c.height);
    const gctx = glyphCanvas.getContext("2d")!;
    const gImgData = gctx.createImageData(c.width, c.height);
    for (let j = 0; j < c.binary.length; j++) {
      const v = c.binary[j];
      gImgData.data[j * 4] = v;
      gImgData.data[j * 4 + 1] = v;
      gImgData.data[j * 4 + 2] = v;
      gImgData.data[j * 4 + 3] = 255;
    }
    gctx.putImageData(gImgData, 0, 0);

    ctx.drawImage(glyphCanvas, gx, gy, sw, sh);

    // Cell border
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);

    // Character label
    ctx.fillStyle = "#00ff88";
    ctx.fillText(c.char, col * cellW + cellW / 2, row * cellH + maxH + cellPad * 2 + 11);
  }

  return offscreenToDataURL(canvas, totalW, totalH);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Convert an OffscreenCanvas to a data URL synchronously
 * by reading raw pixel data and encoding via a regular canvas.
 */
function offscreenToDataURL(oc: OffscreenCanvas, w: number, h: number): string {
  // In browser contexts where OffscreenCanvas doesn't have toDataURL,
  // we transfer pixels to a regular canvas.
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const ocCtx = oc.getContext("2d")!;
    const data = ocCtx.getImageData(0, 0, w, h);
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  }
  // Fallback: shouldn't reach here in browser
  return "";
}

// ─── debug data container ─────────────────────────────────────────────────────

export interface PipelineDebugData {
  /** Preprocessed binary image */
  binaryImage: string;
  /** Binary with Vision bounding boxes overlaid */
  bboxOverlay: string;
  /** Connected components colored by label */
  componentMap: string;
  /** Grid of all extracted character crops */
  charCrops: string;
  /** Vision API recognized characters */
  recognizedChars: { char: string; confidence: number }[];
  /** Number of connected components found */
  componentCount: number;
  /** Number of characters extracted */
  charCount: number;
  /** Image dimensions */
  binaryDimensions: { width: number; height: number };
}
