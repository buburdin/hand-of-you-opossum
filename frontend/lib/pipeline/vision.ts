/**
 * Google Cloud Vision API integration for character recognition.
 *
 * Uses DOCUMENT_TEXT_DETECTION to get per-character bounding boxes
 * and actual text recognition — far more accurate than our
 * position-based segmentation approach.
 */

// ─── types ────────────────────────────────────────────────────────────────────

/** A vertex (point) from Google Vision's bounding polygon. */
export interface Vertex {
  x: number;
  y: number;
}

/** A single symbol (character) detected by Vision API. */
export interface VisionSymbol {
  /** The detected character text */
  text: string;
  /** Bounding polygon vertices (4 corners) */
  boundingBox: {
    vertices: Vertex[];
  };
  /** Detection confidence (0-1) */
  confidence: number;
}

/** A word detected by Vision API (contains symbols). */
interface VisionWord {
  symbols: VisionSymbol[];
  boundingBox: { vertices: Vertex[] };
}

/** A paragraph detected by Vision API (contains words). */
interface VisionParagraph {
  words: VisionWord[];
}

/** A block detected by Vision API (contains paragraphs). */
interface VisionBlock {
  paragraphs: VisionParagraph[];
}

/** A page detected by Vision API (contains blocks). */
interface VisionPage {
  blocks: VisionBlock[];
  width: number;
  height: number;
}

/** Full text annotation from Vision API. */
interface FullTextAnnotation {
  pages: VisionPage[];
  text: string;
}

/** A recognized character with its bounding box. */
export interface RecognizedChar {
  /** The character that was recognized (lowercase) */
  char: string;
  /** Bounding box: x, y, width, height (in Vision API pixel coords) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Detection confidence */
  confidence: number;
}

/** Result from character extraction, including Vision's page dimensions. */
export interface VisionExtractionResult {
  chars: RecognizedChar[];
  /** Vision API's reported page dimensions (coordinate space for bboxes) */
  pageWidth: number;
  pageHeight: number;
}

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Send an image to Google Vision API via our proxy route.
 *
 * @param imageBlob The image as a Blob
 * @returns Full text annotation from Vision API
 */
export async function callVisionAPI(
  imageBlob: Blob,
): Promise<FullTextAnnotation> {
  // Convert blob to base64
  const buffer = await imageBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  const binaryStr = chunks.join("");
  const base64 = btoa(binaryStr);

  // Call our Next.js API route (keeps API key server-side)
  const response = await fetch("/api/vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64 }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Vision API request failed: ${response.status} — ${(err as Record<string, string>).error || "unknown error"}`,
    );
  }

  const data = await response.json();

  // The response has: { responses: [{ fullTextAnnotation: {...} }] }
  const annotation = data?.responses?.[0]?.fullTextAnnotation;
  if (!annotation) {
    throw new Error(
      "Vision API returned no text. Make sure the image contains visible handwriting.",
    );
  }

  if (!Array.isArray(annotation.pages) || annotation.pages.length === 0) {
    throw new Error("Vision API returned an unexpected response format.");
  }

  return annotation as FullTextAnnotation;
}

// ─── character extraction ─────────────────────────────────────────────────────

/**
 * Convert a bounding polygon to a simple x/y/w/h bounding box.
 */
function polyToBBox(vertices: Vertex[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const v of vertices) {
    // Vision API sometimes omits x or y (defaults to 0)
    const vx = v.x ?? 0;
    const vy = v.y ?? 0;
    if (vx < minX) minX = vx;
    if (vy < minY) minY = vy;
    if (vx > maxX) maxX = vx;
    if (vy > maxY) maxY = vy;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Extract all recognized characters from a Vision API response,
 * filtered to only alphabetic characters (a-z), keeping only
 * the first (best) occurrence of each letter.
 *
 * This replaces the old position-based pangram mapping with
 * actual character recognition.
 *
 * @param annotation The full text annotation from Vision API
 * @returns Array of recognized characters with bounding boxes
 */
export function extractRecognizedChars(
  annotation: FullTextAnnotation,
): VisionExtractionResult {
  const allSymbols: RecognizedChar[] = [];

  // Get Vision's page dimensions — this is the coordinate space for all bboxes
  const pageWidth = annotation.pages?.[0]?.width ?? 0;
  const pageHeight = annotation.pages?.[0]?.height ?? 0;

  console.log(`[Vision] Page dimensions: ${pageWidth}x${pageHeight}`);

  for (const page of annotation.pages) {
    for (const block of page.blocks) {
      for (const paragraph of block.paragraphs) {
        for (const word of paragraph.words) {
          for (const symbol of word.symbols) {
            const char = symbol.text?.toLowerCase();
            if (!char || !/^[a-z]$/.test(char)) continue;

            const bbox = polyToBBox(symbol.boundingBox.vertices);

            // Skip tiny detections (likely noise)
            if (bbox.w < 3 || bbox.h < 3) continue;

            allSymbols.push({
              char,
              ...bbox,
              confidence: symbol.confidence ?? 0,
            });
          }
        }
      }
    }
  }

  // Keep only the first occurrence of each letter (highest quality,
  // since Vision processes in reading order)
  const seen = new Set<string>();
  const unique: RecognizedChar[] = [];

  for (const sym of allSymbols) {
    if (seen.has(sym.char)) continue;
    seen.add(sym.char);
    unique.push(sym);
  }

  return { chars: unique, pageWidth, pageHeight };
}
