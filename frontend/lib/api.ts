const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface FontResult {
  ttf: ArrayBuffer;
  woff2: ArrayBuffer;
}

/**
 * Send a pangram photo to the backend for processing.
 * Returns TTF and WOFF2 font files.
 */
export async function processPangram(
  imageFile: File | Blob,
  pangram: string
): Promise<FontResult> {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("pangram", pangram);

  const response = await fetch(`${API_BASE}/api/process-pangram`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Processing failed" }));
    throw new Error(error.detail || "Failed to process pangram image");
  }

  const data = await response.json();

  return {
    ttf: base64ToArrayBuffer(data.ttf),
    woff2: base64ToArrayBuffer(data.woff2),
  };
}

/**
 * Send a single drawn character to the backend.
 * Returns vectorized glyph data.
 */
export async function processGlyph(
  imageBlob: Blob,
  character: string
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("image", imageBlob);
  formData.append("character", character);

  const response = await fetch(`${API_BASE}/api/process-glyph`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Processing failed" }));
    throw new Error(error.detail || "Failed to process glyph");
  }

  return response.json();
}

/**
 * Generate font from a collection of glyph data.
 */
export async function generateFont(
  glyphs: Record<string, Record<string, unknown>>
): Promise<FontResult> {
  const response = await fetch(`${API_BASE}/api/generate-font`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ glyphs }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Font generation failed" }));
    throw new Error(error.detail || "Failed to generate font");
  }

  const data = await response.json();

  return {
    ttf: base64ToArrayBuffer(data.ttf),
    woff2: base64ToArrayBuffer(data.woff2),
  };
}

/**
 * Send all drawn glyphs at once and get back font files.
 */
export async function processDrawnGlyphs(
  glyphImages: Record<string, Blob>
): Promise<FontResult> {
  const formData = new FormData();
  for (const [char, blob] of Object.entries(glyphImages)) {
    formData.append(`char_${char}`, blob, `${char}.png`);
  }

  const response = await fetch(`${API_BASE}/api/process-drawn-glyphs`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Processing failed" }));
    throw new Error(error.detail || "Failed to process drawn glyphs");
  }

  const data = await response.json();

  return {
    ttf: base64ToArrayBuffer(data.ttf),
    woff2: base64ToArrayBuffer(data.woff2),
  };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function downloadFile(data: ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
