"use client";

import { useState, useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion } from "framer-motion";
import { getFontFamilyName } from "@/lib/fontLoader";
import { loadPlayground, savePlayground } from "@/lib/sessionStore";

interface TextPlaygroundProps {
  fontLoaded: boolean;
}

export interface TextPlaygroundHandle {
  getDisplayElement: () => HTMLElement | null;
}

const ROTATING_TEXTS = [
  "autocorrect can't save you here",
  "this is my handwriting and i'm not sorry",
  "i write like a doctor but on purpose",
  "you could've just used arial",
  "handmade in a machine-made world",
  "a love letter to imperfection",
  "congrats, you're a type designer now",
  "type anything, it'll look like you wrote it",
  "OK Computer",
];

type NoteColor = {
  id: string;
  bg: string;
  mid: string;
  end: string;
  swatch: string;
};

const NOTE_COLORS: NoteColor[] = [
  { id: "yellow", bg: "#fff3a2", mid: "#ffed88", end: "#ffe277", swatch: "#ffe882" },
  { id: "pink",   bg: "#ffd6e0", mid: "#ffc8d6", end: "#ffbacc", swatch: "#ffc4d0" },
  { id: "blue",   bg: "#d4eaff", mid: "#c4dffb", end: "#b4d4f7", swatch: "#c4dffa" },
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const TextPlayground = forwardRef<TextPlaygroundHandle, TextPlaygroundProps>(
  function TextPlayground({ fontLoaded }, ref) {
  const saved = useMemo(() => loadPlayground(), []);
  const [text, setText] = useState(saved?.text ?? ROTATING_TEXTS[Math.floor(Math.random() * ROTATING_TEXTS.length)]);
  const [fontSize, setFontSize] = useState(saved?.fontSize ?? 64);
  const [noteColor, setNoteColor] = useState<NoteColor>(
    NOTE_COLORS.find((c) => c.id === saved?.noteColorId) ?? NOTE_COLORS[0],
  );
  const textDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    savePlayground({ text, fontSize, noteColorId: noteColor.id });
  }, [text, fontSize, noteColor]);
  const fontFamily = getFontFamilyName();
  const sampleTexts = useMemo(() => [...pickRandom(ROTATING_TEXTS, 3), "abcdefghijklmnopqrstuvwxyz"], []);

  useImperativeHandle(ref, () => ({
    getDisplayElement: () => textDisplayRef.current,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto"
    >
      <div className="text-center space-y-1">
        <h2 className="text-sm font-medium tracking-wide">your font is ready</h2>
        <p className="text-[10px] uppercase tracking-[0.2em] text-fg/35">
          type on the note
        </p>
      </div>

      {/* Sticky note — type directly on it */}
      <div
        ref={textDisplayRef}
        className={`relative w-full aspect-square rounded-none border ${
          fontLoaded ? "sticky-note" : "border-border bg-surface"
        }`}
        style={{
          boxShadow: fontLoaded ? "var(--shadow-sticky)" : "var(--shadow-md)",
          ...(fontLoaded
            ? {
                background: `linear-gradient(135deg, ${noteColor.bg} 0%, ${noteColor.mid} 60%, ${noteColor.end} 100%)`,
              }
            : {}),
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="start typing..."
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className="absolute inset-0 w-full h-full resize-none bg-transparent border-0 outline-none font-preview break-words p-8 pb-14 placeholder:opacity-30"
          style={{
            fontFamily: fontLoaded ? `"${fontFamily}", sans-serif` : "inherit",
            fontSize: `${fontSize}px`,
            lineHeight: 1.0,
            wordSpacing: "0.4em",
          }}
        />
        {fontLoaded && (
          <span className="absolute bottom-3 right-4 text-[11px] tracking-[0.15em] text-ink/35 select-none pointer-events-none">
            handofyou.app
          </span>
        )}
      </div>

      {/* Note color + font size controls */}
      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center gap-1.5">
          {NOTE_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => setNoteColor(color)}
              aria-label={`${color.id} note`}
              className="w-5 h-5 rounded-full border transition-all"
              style={{
                backgroundColor: color.swatch,
                borderColor:
                  noteColor.id === color.id
                    ? "rgba(26, 26, 26, 0.45)"
                    : "rgba(26, 26, 26, 0.12)",
                transform: noteColor.id === color.id ? "scale(1.15)" : "scale(1)",
              }}
            />
          ))}
        </div>
        <div className="w-px h-3 bg-border" />
        <span className="text-[10px] uppercase tracking-[0.15em] text-fg/40 whitespace-nowrap">
          size
        </span>
        <input
          type="range"
          min={16}
          max={256}
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value))}
          className="flex-1 accent-fg/60 h-[2px]"
        />
        <span className="text-[10px] text-fg/40 w-8 text-right font-mono">
          {fontSize}
        </span>
      </div>

      {/* Sample text pills — hidden for now */}
      {/* <div className="flex flex-wrap gap-2 justify-center">
        {sampleTexts.map((sample) => (
          <button
            key={sample}
            onClick={() => setText(sample)}
            className="px-3 py-1.5 rounded-full border border-border text-[10px] tracking-wide text-fg/50 hover:text-fg/80 hover:border-fg/25 transition-colors truncate max-w-[200px]"
          >
            {sample}
          </button>
        ))}
      </div> */}

    </motion.div>
  );
});

export default TextPlayground;
