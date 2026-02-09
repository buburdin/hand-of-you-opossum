/**
 * Client-side font generation pipeline.
 *
 * Entry points that replace the old backend API calls:
 * - processPangramLocally()  ->  replaces api.processPangram()
 * - processDrawnGlyphsLocally()  ->  replaces api.processDrawnGlyphs()
 */

import { preprocessPhoto, preprocessGlyph } from "./preprocess";
import { segmentCharacters, extractSingleGlyph } from "./segment";
import { initPotrace, vectorizeGlyph, type VectorizedGlyph } from "./vectorize";
import { generateFont, type FontResult } from "./fontgen";

export type { FontResult } from "./fontgen";

/** Yield to the event loop so the browser can paint between heavy pipeline stages. */
const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Process a pangram photo into a font — entirely in the browser.
 *
 * Pipeline:
 * 1. Preprocess image (grayscale, threshold, cleanup)
 * 2. Segment individual characters & map to pangram
 * 3. Vectorize each character bitmap (potrace WASM) — in parallel
 * 4. Generate font (opentype.js)
 */
export async function processPangramLocally(
  imageBlob: Blob,
  pangram: string,
): Promise<FontResult> {
  await initPotrace();

  // 1. Preprocess
  const { binary, width, height } = await preprocessPhoto(imageBlob);
  await yieldToUI();

  // 2. Segment
  const charBitmaps = segmentCharacters(binary, width, height, pangram);
  await yieldToUI();

  if (charBitmaps.length === 0) {
    throw new Error(
      "No characters could be segmented from the image. " +
        "Try writing larger and with more spacing.",
    );
  }

  // 3. Vectorize each character — in parallel
  const vectorResults = await Promise.all(
    charBitmaps.map(async ({ char, binary: charBin, width: cw, height: ch }) => ({
      char,
      vectorized: await vectorizeGlyph(charBin, cw, ch),
    })),
  );

  const glyphs: Record<string, VectorizedGlyph> = {};
  for (const { char, vectorized } of vectorResults) {
    if (vectorized.paths.length > 0) {
      glyphs[char] = vectorized;
    }
  }

  if (Object.keys(glyphs).length === 0) {
    throw new Error("No valid glyphs could be vectorized from the image.");
  }

  await yieldToUI();

  // 4. Generate font
  return generateFont(glyphs);
}

/**
 * Process drawn glyphs (from canvas draw mode) into a font — entirely in the browser.
 *
 * Pipeline:
 * 1. Preprocess each drawn character (Otsu threshold)
 * 2. Extract & center each glyph
 * 3. Vectorize (potrace WASM) — in parallel
 * 4. Generate font (opentype.js)
 */
export async function processDrawnGlyphsLocally(
  glyphImages: Record<string, Blob>,
): Promise<FontResult> {
  await initPotrace();

  // 1 & 2. Preprocess and extract each glyph
  const preprocessed = await Promise.all(
    Object.entries(glyphImages).map(async ([char, blob]) => {
      const { binary, width, height } = await preprocessGlyph(blob);
      const extracted = extractSingleGlyph(binary, width, height);
      return { char, ...extracted };
    }),
  );

  await yieldToUI();

  // 3. Vectorize all glyphs in parallel
  const vectorResults = await Promise.all(
    preprocessed.map(async ({ char, binary, width, height }) => ({
      char,
      vectorized: await vectorizeGlyph(binary, width, height),
    })),
  );

  const glyphs: Record<string, VectorizedGlyph> = {};
  for (const { char, vectorized } of vectorResults) {
    if (vectorized.paths.length > 0) {
      glyphs[char.toLowerCase()] = vectorized;
    }
  }

  if (Object.keys(glyphs).length === 0) {
    throw new Error("No valid glyphs could be processed from the drawn characters.");
  }

  await yieldToUI();

  // 4. Generate font
  return generateFont(glyphs);
}
