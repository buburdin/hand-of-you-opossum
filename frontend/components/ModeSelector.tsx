"use client";

import { motion } from "framer-motion";

type Mode = "snap" | "draw";

interface ModeSelectorProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export default function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="relative flex rounded-full border border-border p-0.5 font-mono text-xs tracking-wide"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <motion.div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-fg"
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        style={{
          left: mode === "draw" ? 2 : "50%",
          right: mode === "snap" ? 2 : "50%",
        }}
      />
      <button
        onClick={() => onModeChange("draw")}
        className={`relative z-10 px-5 py-2 rounded-full transition-colors duration-150 ${
          mode === "draw" ? "text-bg" : "text-fg/50"
        }`}
      >
        draw letters
      </button>
      <button
        onClick={() => onModeChange("snap")}
        className={`relative z-10 px-5 py-2 rounded-full transition-colors duration-150 ${
          mode === "snap" ? "text-bg" : "text-fg/50"
        }`}
      >
        snap a pangram
      </button>
    </div>
  );
}
