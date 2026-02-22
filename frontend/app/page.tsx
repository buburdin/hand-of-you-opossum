"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModeSelector from "@/components/ModeSelector";
import PangramCapture from "@/components/PangramCapture";
import DrawCanvas from "@/components/DrawCanvas";
import ProcessingAnimation from "@/components/ProcessingAnimation";
import TextPlayground, { type TextPlaygroundHandle } from "@/components/TextPlayground";
import FontExport, { exportElementAsImage, shareSticker } from "@/components/FontExport";
import ThemeToggle from "@/components/ThemeToggle";
import {
  processPangramLocally,
  processDrawnGlyphsLocally,
  type FontResult,
  type PipelineDebugData,
} from "@/lib/pipeline";
import { loadFont } from "@/lib/fontLoader";
import DebugOverlay from "@/components/DebugOverlay";

type Step = "landing" | "input" | "processing" | "playground";
type Mode = "snap" | "draw";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [mode, setMode] = useState<Mode>("draw");
  const [processingStep, setProcessingStep] = useState(0);
  const [fontResult, setFontResult] = useState<FontResult | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [charsFound, setCharsFound] = useState<string[]>([]);
  const [debugData, setDebugData] = useState<PipelineDebugData | null>(null);
  const [drawnGlyphs, setDrawnGlyphs] = useState<Record<string, Blob>>({});
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const playgroundRef = useRef<TextPlaygroundHandle>(null);

  const collectDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

  // Avoid SSR opacity:0 — only animate after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStart = () => {
    setStep("input");
    setError(null);
  };

  const handlePangramCapture = useCallback(
    async (file: File | Blob, pangram: string) => {
      setStep("processing");
      setProcessingStep(0);
      setError(null);

      const stepTimer = setInterval(() => {
        setProcessingStep((s) => Math.min(s + 1, 3));
      }, 800);

      try {
        const result = await processPangramLocally(file, pangram, collectDebug);
        setProcessingStep(3);

        setFontResult(result);
        if (result.debug) setDebugData(result.debug);
        await loadFont(result.ttf);
        setFontLoaded(true);
        setCharsFound(result.charsFound);

        setTimeout(() => setStep("playground"), 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStep("input");
      } finally {
        clearInterval(stepTimer);
      }
    },
    []
  );

  const handleDrawComplete = useCallback(
    async (glyphImages: Record<string, Blob>) => {
      setStep("processing");
      setProcessingStep(0);
      setError(null);

      const stepTimer = setInterval(() => {
        setProcessingStep((s) => Math.min(s + 1, 3));
      }, 600);

      try {
        const result = await processDrawnGlyphsLocally(glyphImages);
        setProcessingStep(3);

        setFontResult(result);
        await loadFont(result.ttf);
        setFontLoaded(true);
        setCharsFound(result.charsFound);

        setTimeout(() => setStep("playground"), 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStep("input");
      } finally {
        clearInterval(stepTimer);
      }
    },
    []
  );

  const handleStartOver = () => {
    setStep("landing");
    setFontResult(null);
    setFontLoaded(false);
    setCharsFound([]);
    setDrawnGlyphs({});
    setDebugData(null);
    setError(null);
  };

  const handleEditLetters = () => {
    setStep("input");
    setMode("draw");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center px-5 py-8 md:py-16 font-mono">
      {/* Header — always visible, no animation on SSR */}
      <header className="w-full max-w-2xl flex items-center justify-between mb-12">
        <button
          onClick={handleStartOver}
          className="text-sm font-medium tracking-tight hover:opacity-60 transition-opacity"
        >
          hand of you
        </button>
        <div className="flex items-center gap-3">
          {step !== "landing" && (
            <button
              onClick={handleStartOver}
              className="text-[10px] uppercase tracking-[0.2em] text-fg/35 hover:text-fg/60 transition-colors"
            >
              start over
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-2xl flex flex-col items-center">
        <AnimatePresence mode="wait">
          {/* Landing */}
          {step === "landing" && (
            <motion.div
              key="landing"
              initial={mounted ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="flex-1 flex flex-col items-center justify-center gap-10 text-center"
            >
              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
                  turn your handwriting
                  <br />
                  into a font
                </h1>
                <p className="text-sm text-fg/45 max-w-sm mx-auto leading-relaxed">
                  snap a photo of your handwriting or draw letters on screen.
                  we&apos;ll make a font file you can use anywhere.
                </p>
              </div>

              <motion.button
                onClick={handleStart}
                className="px-8 py-3.5 rounded-full bg-fg text-bg text-sm tracking-wide hover:bg-fg/85 transition-colors"
                style={{ boxShadow: "var(--shadow-md)" }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                make your font
              </motion.button>

              <div className="flex gap-6 text-[10px] uppercase tracking-[0.2em] text-fg/25">
                <span>free</span>
                <span>&middot;</span>
                <span>no signup</span>
                <span>&middot;</span>
                <span>instant</span>
              </div>
            </motion.div>
          )}

          {/* Input mode */}
          {step === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="flex flex-col items-center gap-8 w-full"
            >
              <ModeSelector mode={mode} onModeChange={setMode} />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-lg px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-600"
                >
                  {error}
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {mode === "snap" ? (
                  <PangramCapture
                    key="snap"
                    onCapture={handlePangramCapture}
                  />
                ) : (
                  <DrawCanvas
                    key="draw"
                    onComplete={handleDrawComplete}
                    initialGlyphs={drawnGlyphs}
                    onGlyphsChange={setDrawnGlyphs}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Processing */}
          {step === "processing" && (
            <ProcessingAnimation key="processing" step={processingStep} />
          )}

          {/* Playground */}
          {step === "playground" && (
            <motion.div
              key="playground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
              className="flex flex-col items-center gap-8 w-full"
            >
              <TextPlayground
                ref={playgroundRef}
                fontLoaded={fontLoaded}
              />
              <FontExport
                ttfData={fontResult?.ttf ?? null}
                charsFound={charsFound}
                onEditLetters={handleEditLetters}
                onExportImage={() => {
                  const el = playgroundRef.current?.getDisplayElement();
                  if (el) exportElementAsImage(el).catch(() => {
                    alert("Failed to save image. Please try again.");
                  });
                }}
                onShare={async () => {
                  const el = playgroundRef.current?.getDisplayElement();
                  if (!el) return;
                  const result = await shareSticker(el);
                  if (result === "copied") {
                    setToast("image copied to clipboard");
                    setTimeout(() => setToast(null), 2500);
                  }
                }}
              />
              {debugData ? (
                <DebugOverlay debug={debugData} />
              ) : (
                <div className="w-full max-w-2xl mx-auto">
                  <a
                    href="/?debug"
                    className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-fg/35 hover:text-fg/60 transition-colors"
                  >
                    Pipeline debug: add ?debug to URL and process again to see pipeline stages
                  </a>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-16 text-[9px] uppercase tracking-[0.3em] text-fg">
        <a href="https://x.com/buburdin" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition-opacity">Alex Burdin</a>
        {" & "}
        <a href="https://github.com/joi-rio" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition-opacity">Max Yugi</a>
      </footer>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-fg text-bg text-xs tracking-wide"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
