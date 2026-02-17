"use client";

import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { getFontEmbedCSS } from "@/lib/fontLoader";

/** Trigger a file download from an ArrayBuffer. */
function downloadFile(data: ArrayBuffer, filename: string, mimeType: string) {
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

interface FontExportProps {
  ttfData: ArrayBuffer | null;
  charsFound?: string[];
  onExportImage?: () => void;
}

export default function FontExport({
  ttfData,
  charsFound = [],
  onExportImage,
}: FontExportProps) {
  const handleDownloadTTF = () => {
    if (ttfData) {
      downloadFile(ttfData, "my-handwriting.ttf", "font/ttf");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.1 }}
      className="flex flex-col items-center gap-4"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onExportImage}
          className="px-5 py-2.5 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          save as image
        </button>
        <button
          onClick={handleDownloadTTF}
          disabled={!ttfData}
          className="px-5 py-2.5 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors disabled:opacity-30"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          download .ttf
        </button>
      </div>

      {charsFound.length > 0 && (
        <p className="text-[10px] text-fg/30 tracking-wide">
          {charsFound.length} letters extracted: {[...charsFound].sort().join(" ")}
        </p>
      )}
    </motion.div>
  );
}

/**
 * Export a DOM element as a PNG image.
 */
export async function exportElementAsImage(element: HTMLElement) {
  try {
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
  } catch (err) {
    console.error("Failed to export image:", err);
    throw err;
  }
}
