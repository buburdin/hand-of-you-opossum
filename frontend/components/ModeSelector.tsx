"use client";

import { motion } from "framer-motion";
import { springSnappy } from "@/lib/motion";
import type { Mode } from "@/lib/types";

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
        initial={false}
        animate={{
          left: mode === "snap" ? "2px" : "50%",
          right: mode === "draw" ? "2px" : "50%",
        }}
        transition={springSnappy}
      />
      <button
        onClick={() => onModeChange("snap")}
        className={`relative z-10 px-5 py-2 rounded-full transition-colors duration-150 ${
          mode === "snap" ? "text-bg" : "text-fg/50"
        }`}
      >
        snap a pangram
      </button>
      <button
        onClick={() => onModeChange("draw")}
        className={`relative z-10 px-5 py-2 rounded-full transition-colors duration-150 ${
          mode === "draw" ? "text-bg" : "text-fg/50"
        }`}
      >
        draw letters
      </button>
    </div>
  );
}
