const FONT_FAMILY_NAME = "UserHandwriting";

let currentFontUrl: string | null = null;
let currentFontDataUrl: string | null = null;

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

/**
 * Load a font from an ArrayBuffer (TTF/OTF) into the browser,
 * making it available for use via CSS font-family.
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

  const mimeType = "font/sfnt";

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

/**
 * Unload the current font and clean up resources.
 * Call this when resetting/starting over.
 */
export function unloadFont(): void {
  if (currentFontUrl) {
    URL.revokeObjectURL(currentFontUrl);
    currentFontUrl = null;
  }
  currentFontDataUrl = null;

  for (const face of document.fonts) {
    if (face.family === FONT_FAMILY_NAME) {
      document.fonts.delete(face);
    }
  }
}

export function getFontFamilyName(): string {
  return FONT_FAMILY_NAME;
}

/**
 * Get a CSS @font-face rule with the font embedded as a base64 data URL.
 * Used by html-to-image to embed the custom font in exported images.
 */
export function getFontEmbedCSS(): string | null {
  if (!currentFontDataUrl) return null;
  return `@font-face {
  font-family: "${FONT_FAMILY_NAME}";
  src: url(${currentFontDataUrl}) format("truetype");
  font-weight: normal;
  font-style: normal;
}`;
}
