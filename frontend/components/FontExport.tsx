"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import { getFontEmbedCSS } from "@/lib/fontLoader";
import { generateFont } from "@/lib/pipeline/fontgen";
import type { VectorizedGlyph } from "@/lib/pipeline/vectorize";

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
  glyphs?: Record<string, VectorizedGlyph>;
  referenceHeight?: number;
  onExportImage?: () => void;
  onShare?: () => void;
  onEditLetters?: () => void;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function FontExport({
  ttfData,
  charsFound = [],
  glyphs,
  referenceHeight,
  onExportImage,
  onShare,
  onEditLetters,
}: FontExportProps) {
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [preview, setPreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNameModal) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [showNameModal]);

  useEffect(() => {
    const sanitized = nameInput.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    setPreview(`hand-of-${sanitized || "you"}-XXX`);
  }, [nameInput]);

  const closeModal = useCallback(() => {
    setShowNameModal(false);
    setNameInput("");
  }, []);

  const doDownload = useCallback(() => {
    if (!ttfData) return;

    const sanitized = nameInput.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const name = sanitized || "you";
    const suffix = String(Math.floor(Math.random() * 900) + 100);
    const fontName = `hand-of-${name}-${suffix}`;

    let data = ttfData;
    if (glyphs && Object.keys(glyphs).length > 0) {
      data = generateFont(glyphs, fontName, referenceHeight).ttf;
    }

    downloadFile(data, `${fontName}.ttf`, "font/ttf");
    closeModal();
  }, [ttfData, glyphs, referenceHeight, nameInput, closeModal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doDownload();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex flex-col md:flex-row items-center gap-3">
          <button
            onClick={onShare}
            className="md:order-3 w-full md:w-auto px-5 py-3 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            share
          </button>
          <div className="flex items-center gap-3">
            {onEditLetters && (
              <button
                onClick={onEditLetters}
                className="px-5 py-3 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                edit letters
              </button>
            )}
            <button
              onClick={onExportImage}
              className="px-5 py-3 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              save as image
            </button>
            <button
              onClick={() => setShowNameModal(true)}
              disabled={!ttfData}
              className="px-5 py-3 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors disabled:opacity-30"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              download .ttf
            </button>
          </div>
        </div>

        {charsFound.length > 0 && (
          <p className="text-[10px] text-fg/30 tracking-wide">
            {charsFound.length} letters extracted: {[...charsFound].sort().join(" ")}
          </p>
        )}
      </motion.div>

      <AnimatePresence>
        {showNameModal && (
          <motion.div
            key="name-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-bg/90 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              key="name-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={spring}
              className="relative w-full max-w-sm rounded-3xl border border-border px-6 pt-8 pb-6 flex flex-col items-center gap-6"
              style={{
                backgroundColor: "var(--surface)",
                boxShadow: "var(--shadow-lg)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
                className="absolute top-3 right-3 w-8 h-8 rounded-full border border-border flex items-center justify-center text-fg/40 hover:text-fg transition-colors text-xl leading-none"
              >
                &times;
              </button>

              <h3 className="text-sm tracking-tight text-fg">
                  title your font
              </h3>

              <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-5">
                <div className="w-full flex flex-col items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="your name"
                    className="w-full px-4 py-5 rounded-xl border border-border bg-bg text-sm text-fg text-center placeholder:text-fg/20 outline-none focus:border-fg/30 transition-colors"
                  />
                  <p className="text-[10px] text-fg/25 tracking-wide">
                    {preview}.ttf
                  </p>
                </div>

                <button
                  type="submit"
                  className="px-8 py-3 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors"
                  style={{ boxShadow: "var(--shadow-sm)" }}
                >
                  download
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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

function buildDateSlug(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const day = now.getDate();
  return `${month}${day}`;
}

export async function exportElementAsImage(element: HTMLElement) {
  const dataUrl = await toPng(element, buildImageOptions());
  const link = document.createElement("a");
  link.download = `handofyou.app-${buildDateSlug()}.png`;
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
    const file = new File([blob], `handofyou.app-${buildDateSlug()}.png`, { type: "image/png" });

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
