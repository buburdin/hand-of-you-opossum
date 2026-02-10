"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PipelineDebugData } from "@/lib/pipeline";

interface DebugOverlayProps {
  debug: PipelineDebugData;
}

const stages = [
  { key: "binaryImage", label: "1. Binary (preprocessed)" },
  { key: "bboxOverlay", label: "2. Vision bounding boxes" },
  { key: "componentMap", label: "3. Connected components" },
  { key: "charCrops", label: "4. Extracted characters" },
] as const;

export default function DebugOverlay({ debug }: DebugOverlayProps) {
  const [open, setOpen] = useState(false);
  const [activeStage, setActiveStage] = useState(0);

  const currentImage = debug[stages[activeStage].key];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-fg/35 hover:text-fg/60 transition-colors mx-auto"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        pipeline debug
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl border border-border bg-bg p-4 space-y-4"
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              {/* Stats bar */}
              <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.15em] text-fg/40">
                <span>
                  binary: {debug.binaryDimensions.width}&times;{debug.binaryDimensions.height}
                </span>
                <span>
                  components: {debug.componentCount}
                </span>
                <span>
                  chars extracted: {debug.charCount}
                </span>
                <span>
                  recognized: {debug.recognizedChars.map((c) => c.char).join("")}
                </span>
              </div>

              {/* Stage tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {stages.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => setActiveStage(i)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-md text-[10px] tracking-wide transition-colors ${
                      i === activeStage
                        ? "bg-fg text-bg"
                        : "text-fg/40 hover:text-fg/60 hover:bg-fg/5"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Image display */}
              {currentImage ? (
                <div className="rounded-lg overflow-hidden border border-border bg-black">
                  <img
                    src={currentImage}
                    alt={stages[activeStage].label}
                    className="w-full h-auto"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-black/50 h-48 flex items-center justify-center text-fg/20 text-xs">
                  no data for this stage
                </div>
              )}

              {/* Confidence table for stage 2 */}
              {activeStage === 1 && debug.recognizedChars.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-fg/50">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 pr-4 font-medium uppercase tracking-wider">char</th>
                        <th className="text-left py-1 font-medium uppercase tracking-wider">confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debug.recognizedChars.map((c) => (
                        <tr key={c.char} className="border-b border-border/50">
                          <td className="py-0.5 pr-4 font-mono text-fg/70">{c.char}</td>
                          <td className="py-0.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-fg/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(c.confidence * 100).toFixed(0)}%`,
                                    backgroundColor: c.confidence > 0.8 ? "#22c55e" : c.confidence > 0.5 ? "#eab308" : "#ef4444",
                                  }}
                                />
                              </div>
                              <span>{(c.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
