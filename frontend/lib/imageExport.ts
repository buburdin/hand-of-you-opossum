"use client";

import { toPng } from "html-to-image";
import { getFontEmbedCSS } from "@/lib/fontLoader";

/**
 * Export a DOM element as a PNG image and trigger download.
 */
export async function exportElementAsImage(element: HTMLElement) {
  const options: Parameters<typeof toPng>[1] = {
    backgroundColor: "#ffffff",
    pixelRatio: 4,
    quality: 1,
  };

  // Embed the custom font so html-to-image renders it correctly
  // (it can't access blob: URLs used by the FontFace API)
  const fontCSS = getFontEmbedCSS();
  if (fontCSS) {
    options.fontEmbedCSS = fontCSS;
  }

  const dataUrl = await toPng(element, options);

  const link = document.createElement("a");
  link.download = "my-handwriting-text.png";
  link.href = dataUrl;
  link.click();
}
