/**
 * Client-side font generation pipeline.
 *
 * Entry points:
 * - processPangramLocally()  →  photo of handwriting → font
 * - processDrawnGlyphsLocally()  →  drawn characters → font
 *
 * The pangram path uses Google Vision API (via /api/vision proxy)
 * for accurate per-character recognition and bounding boxes.
 */

import { preprocessPhoto, preprocessGlyph } from "./preprocess";
import {
  type CharBitmap,
} from "./segment";
import { initPotrace, vectorizeGlyph, type VectorizedGlyph } from "./vectorize";
import { generateFont, type FontResult } from "./fontgen";
import {
  callVisionAPI,
  extractRecognizedChars,
  type RecognizedChar,
} from "./vision";
import {
  binaryToDataURL,
  binaryWithBBoxesToDataURL,
  labeledImageToDataURL,
  charCropsToDataURL,
  type PipelineDebugData,
} from "./debug";
import { labelFullImage, type LabeledImage } from "./components";

export type { FontResult } from "./fontgen";
export type { PipelineDebugData } from "./debug";

// ─── Vision bbox → component matching ─────────────────────────────────────────

/**
 * Compute overlap area between two bounding boxes.
 */
function bboxOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

/**
 * Given labeled components and a Vision bounding box, find which components
 * belong to this character and extract ONLY their pixels into a tight crop.
 *
 * Selection: keep components where >= 30% of their bbox overlaps the Vision bbox.
 * This excludes neighboring letters whose strokes happen to be nearby.
 */
function extractCharByComponents(
  labeled: LabeledImage,
  visionBBox: { x: number; y: number; w: number; h: number },
  pad = 4,
): { binary: Uint8Array; width: number; height: number } | null {
  const { labels, components, width: imgW, height: imgH } = labeled;

  // Find components overlapping this Vision bbox
  const keepLabels = new Set<number>();

  for (const comp of components) {
    const overlap = bboxOverlap(comp.bbox, visionBBox);
    if (overlap <= 0) continue;

    const compBBoxArea = comp.bbox.w * comp.bbox.h;
    const overlapFraction = overlap / compBBoxArea;

    // Keep if >= 30% of the component is inside the Vision bbox
    if (overlapFraction >= 0.3) {
      keepLabels.add(comp.label);
    }
  }

  // Fallback: if nothing passed, take the component with the most overlap
  if (keepLabels.size === 0) {
    let bestLabel = -1;
    let bestOverlap = 0;
    for (const comp of components) {
      const overlap = bboxOverlap(comp.bbox, visionBBox);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestLabel = comp.label;
      }
    }
    if (bestLabel >= 0) keepLabels.add(bestLabel);
  }

  if (keepLabels.size === 0) return null;

  // Find tight bounds of kept pixels
  let minX = imgW, minY = imgH, maxX = 0, maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      const lbl = labels[y * imgW + x];
      if (lbl >= 0 && keepLabels.has(lbl)) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) return null;

  // Crop with padding — only include pixels from kept components
  const x1 = Math.max(0, minX - pad);
  const y1 = Math.max(0, minY - pad);
  const x2 = Math.min(imgW, maxX + 1 + pad);
  const y2 = Math.min(imgH, maxY + 1 + pad);
  const cw = x2 - x1;
  const ch = y2 - y1;

  const cropped = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const srcIdx = (y1 + y) * imgW + (x1 + x);
      const lbl = labels[srcIdx];
      if (lbl >= 0 && keepLabels.has(lbl)) {
        cropped[y * cw + x] = 255;
      }
    }
  }

  return { binary: cropped, width: cw, height: ch };
}

/**
 * Build CharBitmap[] by matching Vision bboxes to full-image connected components.
 * Only the pixels belonging to matching components are extracted — no neighbor bleed.
 */
function visionCharsToCharBitmaps(
  recognized: RecognizedChar[],
  labeled: LabeledImage,
): CharBitmap[] {
  const results: CharBitmap[] = [];
  const seen = new Set<string>();

  for (const rc of recognized) {
    if (seen.has(rc.char)) continue;
    seen.add(rc.char);

    const extracted = extractCharByComponents(labeled, rc);
    if (extracted && extracted.width > 0 && extracted.height > 0) {
      results.push({ char: rc.char, ...extracted });
    }
  }

  return results;
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Result from the pangram pipeline, including optional debug data.
 */
export interface PangramResult extends FontResult {
  debug?: PipelineDebugData;
}

/**
 * Process a pangram photo into a font — entirely in the browser.
 *
 * Pipeline:
 * 1. Preprocess image (grayscale, threshold, cleanup)
 * 2. Recognize characters via Google Vision API
 * 3. Vectorize each character bitmap (potrace WASM)
 * 4. Generate font (opentype.js)
 *
 * @param imageBlob The photo of handwritten pangram
 * @param pangram   The pangram text the user was asked to write
 * @param collectDebug  Whether to collect debug visualization data
 * @returns Font ArrayBuffer + metadata + optional debug data
 */
export async function processPangramLocally(
  imageBlob: Blob,
  pangram: string,
  collectDebug = false,
): Promise<PangramResult> {
  // Ensure potrace is ready (downloads WASM on first call)
  await initPotrace();

  // 1. Preprocess
  const { binary, width, height } = await preprocessPhoto(imageBlob);

  // 2. Label connected components on the full binary image (once)
  const labeled = labelFullImage(binary, width, height);

  console.log(
    `[Pipeline] Labeled ${labeled.components.length} components in ${width}x${height} binary`,
  );

  // Debug: binary image + component map
  let debug: PipelineDebugData | undefined;
  if (collectDebug) {
    debug = {
      binaryImage: binaryToDataURL(binary, width, height),
      bboxOverlay: "",
      componentMap: labeledImageToDataURL(labeled.labels, width, height, labeled.components.length),
      charCrops: "",
      recognizedChars: [],
      componentCount: labeled.components.length,
      charCount: 0,
      binaryDimensions: { width, height },
    };
  }

  // 3. Recognize characters via Google Vision API
  // Downscale the original image to the preprocessed dimensions before sending
  // to Vision API. The original imageBlob can be 3-5MB; this produces a ~100-200KB JPEG.
  const visionBitmap = await createImageBitmap(imageBlob);
  const visionCanvas = new OffscreenCanvas(width, height);
  const visionCtx = visionCanvas.getContext("2d")!;
  visionCtx.drawImage(visionBitmap, 0, 0, width, height);
  const visionBlob = await visionCanvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  visionBitmap.close();

  console.log(
    `[Pipeline] Vision API blob: ${(visionBlob.size / 1024).toFixed(0)}KB (downscaled from ${(imageBlob.size / 1024).toFixed(0)}KB)`,
  );

  const annotation = await callVisionAPI(visionBlob);
  const { chars: rawRecognizedChars, pageWidth, pageHeight } =
    extractRecognizedChars(annotation);

  if (rawRecognizedChars.length === 0) {
    throw new Error(
      "No characters were recognized in the image. " +
        "Make sure your handwriting is clearly visible with good contrast.",
    );
  }

  // Scale Vision coordinates from original image space → binary image space.
  const scaleX = pageWidth > 0 ? width / pageWidth : 1;
  const scaleY = pageHeight > 0 ? height / pageHeight : 1;

  console.log(
    `[Vision] Scale: vision ${pageWidth}x${pageHeight} → binary ${width}x${height} (${scaleX.toFixed(3)}x, ${scaleY.toFixed(3)}y)`,
  );

  const recognizedChars: RecognizedChar[] = rawRecognizedChars.map((rc) => ({
    ...rc,
    x: Math.round(rc.x * scaleX),
    y: Math.round(rc.y * scaleY),
    w: Math.max(1, Math.round(rc.w * scaleX)),
    h: Math.max(1, Math.round(rc.h * scaleY)),
  }));

  // 4. Match Vision bboxes to components — extract only matched pixels
  const charBitmaps = visionCharsToCharBitmaps(recognizedChars, labeled);

  if (charBitmaps.length === 0) {
    throw new Error(
      "No characters could be extracted from the image. " +
        "Try writing larger and with more spacing.",
    );
  }

  // Debug: bounding boxes + char crops
  if (debug) {
    debug.recognizedChars = recognizedChars.map((rc) => ({
      char: rc.char,
      confidence: rc.confidence,
    }));
    debug.bboxOverlay = binaryWithBBoxesToDataURL(
      binary,
      width,
      height,
      recognizedChars,
    );
    debug.charCrops = charCropsToDataURL(charBitmaps);
    debug.charCount = charBitmaps.length;
  }

  // 3. Vectorize each character (concurrently)
  const vectorResults = await Promise.all(
    charBitmaps.map(async ({ char, binary: charBin, width: cw, height: ch }) => {
      const vectorized = await vectorizeGlyph(charBin, cw, ch);
      return vectorized.paths.length > 0 ? [char, vectorized] as const : null;
    })
  );
  const glyphs: Record<string, VectorizedGlyph> = {};
  for (const r of vectorResults) {
    if (r) glyphs[r[0]] = r[1];
  }

  if (Object.keys(glyphs).length === 0) {
    throw new Error("No valid glyphs could be vectorized from the image.");
  }

  // 4. Generate font
  const fontResult = generateFont(glyphs);
  return { ...fontResult, debug };
}

/**
 * Process drawn glyphs (from canvas draw mode) into a font — entirely in the browser.
 *
 * Pipeline:
 * 1. Preprocess each drawn character (Otsu threshold)
 * 2. Extract & center each glyph
 * 3. Vectorize (potrace WASM)
 * 4. Generate font (opentype.js)
 *
 * @param glyphImages Map of character → Blob (PNG from canvas)
 * @returns Font ArrayBuffer + metadata
 */
export async function processDrawnGlyphsLocally(
  glyphImages: Record<string, Blob>,
): Promise<FontResult> {
  // Ensure potrace is ready
  await initPotrace();

  const drawnResults = await Promise.all(
    Object.entries(glyphImages).map(async ([char, blob]) => {
      // 1. Preprocess
      const { binary, width, height } = await preprocessGlyph(blob);

      // 2. Vectorize full canvas (no crop — preserves vertical position for uniform scaling)
      const vectorized = await vectorizeGlyph(binary, width, height);

      return vectorized.paths.length > 0 ? [char.toLowerCase(), vectorized] as const : null;
    })
  );
  const glyphs: Record<string, VectorizedGlyph> = {};
  let referenceHeight: number | undefined;
  for (const r of drawnResults) {
    if (r) {
      glyphs[r[0]] = r[1];
      // All canvases are the same size — capture potraceHeight from first glyph
      if (referenceHeight === undefined && r[1].potraceHeight) {
        referenceHeight = r[1].potraceHeight;
      }
    }
  }

  if (Object.keys(glyphs).length === 0) {
    throw new Error("No valid glyphs could be processed from the drawn characters.");
  }

  // 4. Generate font (pass referenceHeight for uniform scaling in draw mode)
  return generateFont(glyphs, "MyHandwriting", referenceHeight);
}
