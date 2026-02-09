"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { getFontFamilyName } from "@/lib/fontLoader";
import { spring } from "@/lib/motion";

interface TextPlaygroundProps {
  fontLoaded: boolean;
  onExportImage: (element: HTMLElement) => void;
}

const SAMPLE_TEXTS = [
  "the quick brown fox jumps over the lazy dog",
  "hello world, this is my handwriting!",
  "abcdefghijklmnopqrstuvwxyz",
  "pack my box with five dozen liquor jugs",
];

export default function TextPlayground({
  fontLoaded,
  onExportImage,
}: TextPlaygroundProps) {
  const [text, setText] = useState("hello world, this is my handwriting!");
  const [fontSize, setFontSize] = useState(36);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const fontFamily = getFontFamilyName();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto"
    >
      <div className="text-center space-y-1">
        <h2 className="text-sm font-medium tracking-wide">your font is ready</h2>
        <p className="text-[10px] uppercase tracking-[0.2em] text-fg/35">
          type anything below
        </p>
      </div>

      {/* Text display area */}
      <div
        ref={textDisplayRef}
        className={`w-full aspect-square p-8 rounded-none border ${
          fontLoaded ? "sticky-note" : "border-border bg-surface"
        }`}
        style={{
          boxShadow: fontLoaded ? "var(--shadow-sticky)" : "var(--shadow-md)",
        }}
      >
        <div
          className="font-preview break-words"
          style={{
            fontFamily: fontLoaded ? `"${fontFamily}", sans-serif` : "inherit",
            fontSize: `${fontSize}px`,
            lineHeight: 1.5,
          }}
        >
          {text || (
            <span className={fontLoaded ? "text-ink/20" : "text-fg/20"}>
              start typing...
            </span>
          )}
        </div>
      </div>

      {/* Text input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="type something..."
        rows={2}
        className="w-full px-4 py-3 rounded-lg border border-border bg-transparent text-sm resize-none focus:outline-none focus:border-fg/30 transition-colors font-mono"
        style={{ boxShadow: "var(--shadow-sm)" }}
      />

      {/* Font size slider */}
      <div className="flex items-center gap-4 w-full">
        <span className="text-[10px] uppercase tracking-[0.15em] text-fg/40 whitespace-nowrap">
          size
        </span>
        <input
          type="range"
          min={16}
          max={72}
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value))}
          className="flex-1 accent-fg/60 h-[2px]"
        />
        <span className="text-[10px] text-fg/40 w-8 text-right font-mono">
          {fontSize}
        </span>
      </div>

      {/* Sample text pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {SAMPLE_TEXTS.map((sample) => (
          <button
            key={sample}
            onClick={() => setText(sample)}
            className="px-3 py-1.5 rounded-full border border-border text-[10px] tracking-wide text-fg/50 hover:text-fg/80 hover:border-fg/25 transition-colors truncate max-w-[200px]"
          >
            {sample}
          </button>
        ))}
      </div>

      {/* Export button */}
      <button
        onClick={() => textDisplayRef.current && onExportImage(textDisplayRef.current)}
        className="px-5 py-2.5 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        save as image
      </button>
    </motion.div>
  );
}
