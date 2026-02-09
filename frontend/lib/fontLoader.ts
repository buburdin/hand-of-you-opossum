const FONT_FAMILY_NAME = "UserHandwriting";

let currentFontUrl: string | null = null;
let currentFontDataUrl: string | null = null;
let currentFontFormat: "truetype" | "woff2" = "truetype";

/**
 * Convert an ArrayBuffer to a base64 data URL.
 */
function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

type FontFormat = "truetype" | "woff2";

/**
 * Detect font format from an ArrayBuffer by checking the magic bytes.
 * - OTF/TTF starts with 0x00010000 or 'OTTO'
 * - WOFF2 starts with 'wOF2'
 */
function detectFontFormat(buffer: ArrayBuffer): FontFormat {
  const view = new DataView(buffer);
  if (buffer.byteLength < 4) return "truetype";

  const magic = view.getUint32(0);
  // wOF2 = 0x774F4632
  if (magic === 0x774f4632) return "woff2";
  return "truetype";
}

/**
 * Load a font from an ArrayBuffer (TTF, OTF, or WOFF2) into the browser,
 * making it available for use via CSS font-family.
 *
 * Auto-detects the format from the buffer contents.
 */
export async function loadFont(fontBuffer: ArrayBuffer): Promise<string> {
  // Clean up previous font URL
  if (currentFontUrl) {
    URL.revokeObjectURL(currentFontUrl);
  }

  // Remove old FontFace if it exists
  for (const face of document.fonts) {
    if (face.family === FONT_FAMILY_NAME) {
      document.fonts.delete(face);
    }
  }

  // Detect format
  const format = detectFontFormat(fontBuffer);
  currentFontFormat = format;

  const mimeType = format === "woff2" ? "font/woff2" : "font/sfnt";

  // Store as base64 data URL for image export (html-to-image can't access blob: URLs)
  currentFontDataUrl = arrayBufferToDataUrl(fontBuffer, mimeType);

  const blob = new Blob([fontBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  currentFontUrl = url;

  const fontFace = new FontFace(FONT_FAMILY_NAME, `url(${url})`);
  await fontFace.load();
  document.fonts.add(fontFace);

  return FONT_FAMILY_NAME;
}

export function getFontFamilyName(): string {
  return FONT_FAMILY_NAME;
}

/**
 * Get a CSS @font-face rule with the font embedded as a base64 data URL.
 * Used by html-to-image to embed the custom font in exported images.
 *
 * The format() hint matches the actual font data so browsers don't
 * silently ignore it (this was the cause of broken sticky-note exports).
 */
export function getFontEmbedCSS(): string | null {
  if (!currentFontDataUrl) return null;
  return `@font-face {
  font-family: "${FONT_FAMILY_NAME}";
  src: url(${currentFontDataUrl}) format("${currentFontFormat}");
  font-weight: normal;
  font-style: normal;
}`;
}
