/**
 * Client-side font generation pipeline.
 *
 * Entry points that replace the old backend API calls:
 * - processPangramLocally()  →  replaces api.processPangram()
 * - processDrawnGlyphsLocally()  →  replaces api.processDrawnGlyphs()
 */

import { preprocessPhoto, preprocessGlyph } from "./preprocess";
import { segmentCharacters, extractSingleGlyph } from "./segment";
import { initPotrace, vectorizeGlyph, type VectorizedGlyph } from "./vectorize";
import { generateFont, type FontResult } from "./fontgen";

export type { FontResult } from "./fontgen";

/**
 * Process a pangram photo into a font — entirely in the browser.
 *
 * Pipeline:
 * 1. Preprocess image (grayscale, threshold, cleanup)
 * 2. Segment individual characters & map to pangram
 * 3. Vectorize each character bitmap (potrace WASM)
 * 4. Generate font (opentype.js)
 *
 * @param imageBlob The photo of handwritten pangram
 * @param pangram   The pangram text the user was asked to write
 * @returns Font ArrayBuffer + metadata
 */
export async function processPangramLocally(
  imageBlob: Blob,
  pangram: string,
): Promise<FontResult> {
  // Ensure potrace is ready (downloads WASM on first call)
  await initPotrace();

  // 1. Preprocess
  const { binary, width, height } = await preprocessPhoto(imageBlob);

  // 2. Segment
  const charBitmaps = segmentCharacters(binary, width, height, pangram);

  if (charBitmaps.length === 0) {
    throw new Error(
      "No characters could be segmented from the image. " +
        "Try writing larger and with more spacing.",
    );
  }

  // 3. Vectorize each character
  const glyphs: Record<string, VectorizedGlyph> = {};
  for (const { char, binary: charBin, width: cw, height: ch } of charBitmaps) {
    const vectorized = await vectorizeGlyph(charBin, cw, ch);
    if (vectorized.paths.length > 0) {
      glyphs[char] = vectorized;
    }
  }

  if (Object.keys(glyphs).length === 0) {
    throw new Error("No valid glyphs could be vectorized from the image.");
  }

  // 4. Generate font
  return generateFont(glyphs);
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

  const glyphs: Record<string, VectorizedGlyph> = {};

  for (const [char, blob] of Object.entries(glyphImages)) {
    // 1. Preprocess
    const { binary, width, height } = await preprocessGlyph(blob);

    // 2. Extract & center
    const extracted = extractSingleGlyph(binary, width, height);

    // 3. Vectorize
    const vectorized = await vectorizeGlyph(
      extracted.binary,
      extracted.width,
      extracted.height,
    );

    if (vectorized.paths.length > 0) {
      glyphs[char.toLowerCase()] = vectorized;
    }
  }

  if (Object.keys(glyphs).length === 0) {
    throw new Error("No valid glyphs could be processed from the drawn characters.");
  }

  // 4. Generate font
  return generateFont(glyphs);
}
