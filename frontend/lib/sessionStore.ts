const SESSION_KEY = "hoy-session";
const PLAYGROUND_KEY = "hoy-playground";
const DRAW_KEY = "hoy-draw";

export interface SavedSession {
  fontBase64: string;
  charsFound: string[];
  mode: "snap" | "draw";
}

export interface SavedPlayground {
  text: string;
  fontSize: number;
  noteColorId: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(chunks.join(""));
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function saveSession(
  fontBuffer: ArrayBuffer,
  charsFound: string[],
  mode: "snap" | "draw",
): void {
  try {
    const data: SavedSession = {
      fontBase64: arrayBufferToBase64(fontBuffer),
      charsFound,
      mode,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // Storage full — silently degrade
  }
}

export function loadSession(): (SavedSession & { fontBuffer: ArrayBuffer }) | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data: SavedSession = JSON.parse(raw);
    if (!data.fontBase64 || !data.charsFound) return null;
    return { ...data, fontBuffer: base64ToArrayBuffer(data.fontBase64) };
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PLAYGROUND_KEY);
  sessionStorage.removeItem(DRAW_KEY);
}

export function savePlayground(state: SavedPlayground): void {
  try {
    sessionStorage.setItem(PLAYGROUND_KEY, JSON.stringify(state));
  } catch {
    // Storage full — silently degrade
  }
}

export function loadPlayground(): SavedPlayground | null {
  try {
    const raw = sessionStorage.getItem(PLAYGROUND_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(PLAYGROUND_KEY);
    return null;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return `data:${blob.type};base64,${arrayBufferToBase64(buffer)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/png";
  const buffer = base64ToArrayBuffer(base64);
  return new Blob([buffer], { type: mime });
}

export async function saveDrawProgress(glyphs: Record<string, Blob>): Promise<void> {
  try {
    const entries: Record<string, string> = {};
    for (const [letter, blob] of Object.entries(glyphs)) {
      entries[letter] = await blobToDataUrl(blob);
    }
    sessionStorage.setItem(DRAW_KEY, JSON.stringify(entries));
  } catch {
    // Storage full — silently degrade
  }
}

export function loadDrawProgress(): Record<string, Blob> | null {
  try {
    const raw = sessionStorage.getItem(DRAW_KEY);
    if (!raw) return null;
    const entries: Record<string, string> = JSON.parse(raw);
    const glyphs: Record<string, Blob> = {};
    for (const [letter, dataUrl] of Object.entries(entries)) {
      glyphs[letter] = dataUrlToBlob(dataUrl);
    }
    return Object.keys(glyphs).length > 0 ? glyphs : null;
  } catch {
    sessionStorage.removeItem(DRAW_KEY);
    return null;
  }
}

export function clearDrawProgress(): void {
  sessionStorage.removeItem(DRAW_KEY);
}
