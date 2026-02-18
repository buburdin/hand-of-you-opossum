"use client";

import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { getFontEmbedCSS } from "@/lib/fontLoader";

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

const SITE_URL = "https://handofyou.app";
const SHARE_TEXT = "i turned my handwriting into a font ✍️";

interface FontExportProps {
  ttfData: ArrayBuffer | null;
  charsFound?: string[];
  onExportImage?: () => void;
  onShare?: () => void;
}

export default function FontExport({
  ttfData,
  charsFound = [],
  onExportImage,
  onShare,
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
          className="px-5 py-2.5 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors disabled:opacity-30"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          download .ttf
        </button>
        <button
          onClick={onShare}
          className="px-5 py-2.5 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          share
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

function buildImageOptions(): Parameters<typeof toPng>[1] {
  const options: Parameters<typeof toPng>[1] = {
    backgroundColor: "#ffffff",
    pixelRatio: 4,
    quality: 1,
  };
  const fontCSS = getFontEmbedCSS();
  if (fontCSS) {
    options.fontEmbedCSS = fontCSS;
  }
  return options;
}

export async function exportElementAsImage(element: HTMLElement) {
  const dataUrl = await toPng(element, buildImageOptions());
  const link = document.createElement("a");
  link.download = "my-handwriting-text.png";
  link.href = dataUrl;
  link.click();
}

export async function renderShareImage(element: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(element, buildImageOptions());
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Share the sticky note image via Web Share API or fall back to clipboard.
 * Returns "shared" | "copied" | "failed" so the caller can show feedback.
 */
export async function shareSticker(
  element: HTMLElement,
): Promise<"shared" | "copied" | "failed"> {
  try {
    const blob = await renderShareImage(element);
    const file = new File([blob], "my-handwriting.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        text: SHARE_TEXT,
        url: SITE_URL,
      });
      return "shared";
    }

    // Clipboard fallback for desktop
    if (navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return "copied";
    }

    return "failed";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "failed";
    }
    console.error("Share failed:", err);
    return "failed";
  }
}
