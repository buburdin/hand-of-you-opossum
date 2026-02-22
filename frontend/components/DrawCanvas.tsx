"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStroke } from "perfect-freehand";
import { ALL_LETTERS } from "@/lib/pangrams";

/** Turns perfect-freehand outline points into an SVG path string for Path2D/fill. */
function getSvgPathFromStroke(points: number[][], closed = true): string {
  const len = points.length;
  if (len < 4) return "";
  const avg = (a: number, b: number) => (a + b) / 2;
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `;
  }
  return result + (closed ? "Z" : "");
}

interface DrawCanvasProps {
  onComplete: (glyphImages: Record<string, Blob>) => void;
}

const THICKNESS_OPTIONS = [
  { label: "S", value: 2 },
  { label: "M", value: 4 },
  { label: "L", value: 8 },
  { label: "XL", value: 14 },
] as const;

const OPACITY_OPTIONS = [
  { label: "light", value: 0.08 },
  { label: "medium", value: 0.3 },
  { label: "full", value: 1 },
] as const;

const TIP_OPTIONS = [
  { label: "round", value: "round" as CanvasLineCap },
  { label: "flat", value: "square" as CanvasLineCap },
] as const;

export default function DrawCanvas({ onComplete }: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const currentStrokePointsRef = useRef<[number, number, number][]>([]);
  const isDrawingRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drawnGlyphs, setDrawnGlyphs] = useState<Record<string, Blob>>({});
  const [hasContent, setHasContent] = useState(false);
  // isDrawingRef used for hot path; no UI depends on isDrawing

  // Brush settings
  const [thickness, setThickness] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [tip, setTip] = useState<CanvasLineCap>("round");
  const [showSettings, setShowSettings] = useState(false);

  const currentLetter = ALL_LETTERS[currentIndex];
  const progress = Object.keys(drawnGlyphs).length / ALL_LETTERS.length;

  const clearCanvasSurface = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    // Fill with white so the exported PNG has a white background
    // (transparent pixels decode as black in OpenCV, breaking threshold inversion)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const clearCanvas = useCallback(() => {
    clearCanvasSurface();
    setHasContent(false);
    currentStrokePointsRef.current = [];
    isDrawingRef.current = false;
  }, [clearCanvasSurface]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctxRef.current = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clearCanvasSurface();
    currentStrokePointsRef.current = [];
    isDrawingRef.current = false;
  }, [clearCanvasSurface, currentIndex]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const renderCurrentStroke = useCallback(
    (points: [number, number, number][], last: boolean) => {
      const ctx = ctxRef.current;
      if (!ctx || points.length < 2) return;
      try {
        const outline = getStroke(points, {
          size: thickness,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: false,
          last,
        });
        if (outline.length < 4) return;
        const pathData = getSvgPathFromStroke(outline);
        const path = new Path2D(pathData);
        ctx.fillStyle = `rgba(26, 26, 26, ${opacity})`;
        ctx.fill(path);
      } catch (err) {
        console.error("[DrawCanvas] perfect-freehand error", err);
      }
    },
    [thickness, opacity]
  );

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    setHasContent(true);
    const { x, y } = getPos(e);
    const pressure = typeof e.pressure === "number" ? e.pressure : 0.5;
    currentStrokePointsRef.current = [[x, y, pressure]];
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    const { x, y } = getPos(e);
    const pressure = typeof e.pressure === "number" ? e.pressure : 0.5;
    const points = currentStrokePointsRef.current;
    points.push([x, y, pressure]);

    if (points.length >= 2) {
      renderCurrentStroke(points, false);
    }
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      currentStrokePointsRef.current = [];
      return;
    }
    const ctx = ctxRef.current;
    const points = currentStrokePointsRef.current;
    const { x, y } = getPos(e);
    const pressure = typeof e.pressure === "number" ? e.pressure : 0.5;
    points.push([x, y, pressure]);

    if (points.length === 1) {
      ctx?.beginPath();
      ctx?.arc(x, y, thickness / 2, 0, Math.PI * 2);
      if (ctx) {
        ctx.fillStyle = `rgba(26, 26, 26, ${opacity})`;
        ctx.fill();
      }
    } else if (points.length >= 2) {
      renderCurrentStroke(points, true);
    }

    isDrawingRef.current = false;
    currentStrokePointsRef.current = [];
  };

  const saveAndNext = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to capture canvas as image"));
        },
        "image/png"
      );
    });

    const newGlyphs = { ...drawnGlyphs, [currentLetter]: blob };
    setDrawnGlyphs(newGlyphs);

    if (currentIndex < ALL_LETTERS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All letters done
      onComplete(newGlyphs);
    }
  }, [currentIndex, currentLetter, drawnGlyphs, hasContent, onComplete]);

  // Keyboard shortcut: Enter → next/done
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && hasContent) {
        e.preventDefault();
        saveAndNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasContent, saveAndNext]);

  const skipLetter = () => {
    if (currentIndex < ALL_LETTERS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(drawnGlyphs);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto"
    >
      {/* Progress bar */}
      <div className="w-full">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-fg/40">
            {Object.keys(drawnGlyphs).length} / {ALL_LETTERS.length}
          </span>
          <button
            onClick={skipLetter}
            className="text-[10px] uppercase tracking-[0.15em] text-fg/30 hover:text-fg/60 transition-colors"
          >
            skip
          </button>
        </div>
        <div className="w-full h-[2px] bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-fg/60 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </div>
      </div>

      {/* Letter display */}
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentLetter}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="text-6xl font-medium mb-1"
          >
            {currentLetter}
          </motion.div>
        </AnimatePresence>
        <p className="text-[10px] uppercase tracking-[0.2em] text-fg/35">
          draw this letter
        </p>
      </div>

      {/* Drawing canvas */}
      <div
        className="drawing-canvas w-full aspect-square rounded-xl border border-border bg-paper relative overflow-hidden"
        style={{ boxShadow: "var(--shadow-md)", maxWidth: "320px" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ touchAction: "none" }}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          onPointerLeave={endDraw}
        />
        {/* Guide letter (faint) */}
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-8xl text-ink/[0.04] font-medium select-none">
              {currentLetter}
            </span>
          </div>
        )}
      </div>

      {/* Brush settings toggle + panel */}
      <div className="w-full flex flex-col items-center gap-3" style={{ maxWidth: "320px" }}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-[10px] uppercase tracking-[0.2em] text-fg/30 hover:text-fg/60 transition-colors flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          brush{showSettings ? "" : " settings"}
        </button>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="w-full overflow-hidden"
            >
              <div className="flex flex-col gap-4 py-3 px-4 rounded-xl border border-border bg-surface/60"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                {/* Thickness */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-fg/40">
                    thickness
                  </span>
                  <div className="flex items-center gap-2">
                    {THICKNESS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setThickness(opt.value)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          thickness === opt.value
                            ? "bg-fg text-bg"
                            : "bg-transparent text-fg/35 hover:text-fg/60"
                        }`}
                        title={opt.label}
                      >
                        <span
                          className="block rounded-full bg-current"
                          style={{
                            width: `${Math.max(opt.value * 1.2, 3)}px`,
                            height: `${Math.max(opt.value * 1.2, 3)}px`,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-fg/40">
                    opacity
                  </span>
                  <div className="flex items-center gap-1.5">
                    {OPACITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setOpacity(opt.value)}
                        className={`px-2.5 py-1 rounded-full text-[10px] tracking-wide transition-all ${
                          opacity === opt.value
                            ? "bg-fg text-bg"
                            : "text-fg/35 hover:text-fg/60"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tip style */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-fg/40">
                    tip
                  </span>
                  <div className="flex items-center gap-1.5">
                    {TIP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTip(opt.value)}
                        className={`px-2.5 py-1 rounded-full text-[10px] tracking-wide transition-all ${
                          tip === opt.value
                            ? "bg-fg text-bg"
                            : "text-fg/35 hover:text-fg/60"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={clearCanvas}
          className="px-5 py-2.5 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          clear
        </button>
        <button
          onClick={saveAndNext}
          disabled={!hasContent}
          className="px-5 py-2.5 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {currentIndex < ALL_LETTERS.length - 1 ? "next" : "done"}
        </button>
      </div>

      {/* Letter carousel (mini) */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
        {ALL_LETTERS.map((letter, i) => (
          <motion.div
            key={letter}
            className={`w-6 h-6 rounded text-[10px] flex items-center justify-center cursor-pointer transition-colors ${
              i === currentIndex
                ? "bg-fg text-bg"
                : letter in drawnGlyphs
                ? "bg-fg/10 text-fg/60"
                : "bg-transparent text-fg/20"
            }`}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentIndex(i)}
          >
            {letter}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
