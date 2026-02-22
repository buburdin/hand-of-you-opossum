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
  // Potrace outputs: width="W.000000" height="H.000000"
  const wMatch = svgString.match(/width="(\d+(?:\.\d+)?)(?:px)?"/);
  const hMatch = svgString.match(/height="(\d+(?:\.\d+)?)(?:px)?"/);
  if (wMatch && hMatch) {
    return { width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
  }

  // Fallback: try viewBox
  const vbMatch = svgString.match(
    /viewBox="\s*\S+\s+\S+\s+(\S+)\s+(\S+)\s*"/,
  );
  if (vbMatch) {
    return { width: parseFloat(vbMatch[1]), height: parseFloat(vbMatch[2]) };
  }

  return null;
}

/**
 * Extract the scale factor from potrace's `<g transform="... scale(Sx,Sy)">`.
 * Potrace uses scale(unit, -unit) where unit is typically 0.1 for SVG output,
 * meaning path coordinates are in 10x pixel space.
 */
export function extractPotraceScale(svgString: string): number | null {
  const match = svgString.match(/scale\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)/);
  if (match) {
    return Math.abs(parseFloat(match[1]));
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
  /** Potrace SVG canvas height (in potrace's internal coordinate space) */
  potraceHeight?: number;
}

/**
 * Vectorize a single character bitmap into SVG path data.
 *
 * IMPORTANT: Potrace wraps paths in <g transform="translate(0,H) scale(S,-S)">,
 * which means the raw path coordinates are already in a Y-UP coordinate system
 * (origin at bottom-left, Y increases upward), scaled by 1/S (typically 10x).
 *
 * We return these raw coordinates AS-IS because font coordinates are also Y-UP.
 * fontgen.ts just needs to scale and translate — NO Y-flip needed.
 *
 * @param binary  Binary Uint8Array (0 = bg, 255 = ink)
 * @param width   Bitmap width
 * @param height  Bitmap height
 * @returns SVG path data strings (in potrace's Y-UP raw coords) and source dimensions
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

  // Extract raw path data — already Y-UP from potrace's internal transform
  const paths = extractSvgPaths(svgString);

  // Capture potrace canvas height in PATH coordinate space (not SVG pixel space).
  // Potrace uses <g transform="translate(0,H) scale(S,-S)"> where S is typically 0.1,
  // meaning path coordinates are 10x the pixel coordinates.
  // potraceHeight must be in the same space as the path coords: H / S.
  const viewBox = extractSvgViewBox(svgString);
  const scaleFactor = extractPotraceScale(svgString);
  const potraceHeight = viewBox && scaleFactor
    ? viewBox.height / scaleFactor   // e.g. 756 / 0.1 = 7560
    : undefined;

  return {
    paths,
    sourceWidth: width,
    sourceHeight: height,
    potraceHeight,
  };
}
