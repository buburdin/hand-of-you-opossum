"use client";

import { motion } from "framer-motion";
import { spring } from "@/lib/motion";

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
}

export default function FontExport({
  ttfData,
  charsFound = [],
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
      transition={{ ...spring, delay: 0.1 }}
      className="flex flex-col items-center gap-4"
    >
      <button
        onClick={handleDownloadTTF}
        disabled={!ttfData}
        className="px-5 py-2.5 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors disabled:opacity-30"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        download .ttf
      </button>

      {charsFound.length > 0 && (
        <p className="text-[10px] text-fg/30 tracking-wide">
          {charsFound.length} letters extracted: {charsFound.join(" ")}
        </p>
      )}
    </motion.div>
  );
}
