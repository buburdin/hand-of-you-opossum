/**
 * Bitmap-to-vector conversion using esm-potrace-wasm.
 *
 * Takes binary character bitmaps and produces SVG path data
 * that can be fed into opentype.js for font generation.
 */

import { binaryToImageData } from "./preprocess";

// Lazy-loaded potrace module
let potraceReady = false;
let potraceFn: (source: ImageBitmapSource, options: object) => Promise<string>;

/**
 * Initialize the potrace WASM module (called once, idempotent).
 */
export async function initPotrace(): Promise<void> {
  if (potraceReady) return;
  const mod = await import("esm-potrace-wasm");
  await mod.init();
  potraceFn = mod.potrace;
  potraceReady = true;
}

/**
 * Potrace tracing options tuned for handwriting-to-font conversion.
 */
const TRACE_OPTIONS = {
  turdsize: 2, // suppress small artifacts (2px)
  turnpolicy: 4, // minority turn policy — good for handwriting
  alphamax: 1.0, // corner threshold
  opticurve: 1, // enable curve optimization for smoother output
  opttolerance: 0.2, // curve optimization tolerance
  pathonly: false, // we need the full SVG to parse
  extractcolors: false, // binary image, no colors
  posterizelevel: 1, // no posterization — already binary
};

/**
 * Extract SVG path `d` attribute strings from an SVG document string.
 * Potrace outputs SVG with one or more <path> elements.
 */
export function extractSvgPaths(svgString: string): string[] {
  const paths: string[] = [];

  // Use regex to extract d="..." from path elements
  // This avoids needing a DOM parser (works in workers too)
  const pathRegex = /<path[^>]*\bd="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svgString)) !== null) {
    const d = match[1].trim();
    if (d.length > 0) {
      paths.push(d);
    }
  }

  return paths;
}

/**
 * Get the SVG viewBox dimensions from a potrace SVG output.
 */
export function extractSvgViewBox(
  svgString: string,
): { width: number; height: number } | null {
  // Potrace typically outputs: width="Wpx" height="Hpx"
  const wMatch = svgString.match(/width="(\d+)(?:px)?"/);
  const hMatch = svgString.match(/height="(\d+)(?:px)?"/);
  if (wMatch && hMatch) {
    return { width: parseInt(wMatch[1]), height: parseInt(hMatch[1]) };
  }

  // Fallback: try viewBox
  const vbMatch = svgString.match(/viewBox="[^"]*\s(\d+)\s(\d+)"/);
  if (vbMatch) {
    return { width: parseInt(vbMatch[1]), height: parseInt(vbMatch[2]) };
  }

  return null;
}

export interface VectorizedGlyph {
  /** SVG path d-attribute strings (may be multiple for compound chars like "i") */
  paths: string[];
  /** Original bitmap width in pixels */
  sourceWidth: number;
  /** Original bitmap height in pixels */
  sourceHeight: number;
}

/**
 * Vectorize a single character bitmap into SVG path data.
 *
 * @param binary  Binary Uint8Array (0 = bg, 255 = ink)
 * @param width   Bitmap width
 * @param height  Bitmap height
 * @returns SVG path data strings and source dimensions
 */
export async function vectorizeGlyph(
  binary: Uint8Array,
  width: number,
  height: number,
): Promise<VectorizedGlyph> {
  if (!potraceReady) {
    await initPotrace();
  }

  // Convert binary to ImageData for potrace
  const imageData = binaryToImageData(binary, width, height);

  // Run potrace tracing
  const svgString = await potraceFn(imageData, TRACE_OPTIONS);

  // Extract path data
  const paths = extractSvgPaths(svgString);

  return {
    paths,
    sourceWidth: width,
    sourceHeight: height,
  };
}
