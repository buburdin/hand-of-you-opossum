"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStroke } from "perfect-freehand";
import { ALL_LETTERS, GUIDE_LINES } from "@/lib/pangrams";

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
  initialGlyphs?: Record<string, Blob>;
  onGlyphsChange?: (glyphs: Record<string, Blob>) => void;
}

/** Ghost letter font-size in container-query-height units so it scales with the canvas.
 *  Calibrated for JetBrains Mono (ascender 1020, descender -300, x-height 536, UPM 1000)
 *  so that lowercase x-height ≈ the x-height guide line (30%) and caps fill to near the top. */
const GHOST_FONT_SIZE = '77cqh';

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

interface CompletedStroke {
  pathData: string;
  fillStyle: string;
}

export default function DrawCanvas({ onComplete, initialGlyphs, onGlyphsChange }: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const currentStrokePointsRef = useRef<[number, number, number][]>([]);
  const isDrawingRef = useRef(false);
  const completedStrokesRef = useRef<CompletedStroke[]>([]);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drawnGlyphs, setDrawnGlyphs] = useState<Record<string, Blob>>(initialGlyphs ?? {});
  const [hasContent, setHasContent] = useState(false);

  // Refs to avoid stale closures in async save callbacks
  const drawnGlyphsRef = useRef(drawnGlyphs);
  drawnGlyphsRef.current = drawnGlyphs;
  const hasContentRef = useRef(hasContent);
  hasContentRef.current = hasContent;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Brush settings
  const [thickness, setThickness] = useState(24);
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

  const redrawAll = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Clear to white
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw restored background image if present
    const bgImg = backgroundImageRef.current;
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, rect.width, rect.height);
    }

    // Replay all completed strokes
    for (const stroke of completedStrokesRef.current) {
      const path = new Path2D(stroke.pathData);
      ctx.fillStyle = stroke.fillStyle;
      ctx.fill(path);
    }
  }, []);

  const clearCanvas = useCallback(() => {
    clearCanvasSurface();
    completedStrokesRef.current = [];
    backgroundImageRef.current = null;
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
    completedStrokesRef.current = [];
    backgroundImageRef.current = null;

    // Restore previously saved glyph if it exists
    const letter = ALL_LETTERS[currentIndex];
    const savedBlob = drawnGlyphsRef.current[letter];
    if (savedBlob) {
      const url = URL.createObjectURL(savedBlob);
      const img = new Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        redrawAll();
        URL.revokeObjectURL(url);
        setHasContent(true);
      };
      img.src = url;
    } else {
      setHasContent(false);
    }
  }, [clearCanvasSurface, redrawAll, currentIndex]);

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
          thinning: 0.15,
          smoothing: 0.5,
          streamline: 0.6,
          simulatePressure: false,
          start: { taper: false },
          end: { taper: false },
          last,
        });
        if (outline.length < 4) return;
        const pathData = getSvgPathFromStroke(outline);
        return pathData;
      } catch (err) {
        console.error("[DrawCanvas] perfect-freehand error", err);
        return undefined;
      }
    },
    [thickness]
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
      const pathData = renderCurrentStroke(points, false);
      if (pathData) {
        redrawAll();
        const path = new Path2D(pathData);
        ctx.fillStyle = `rgba(26, 26, 26, ${opacity})`;
        ctx.fill(path);
      }
    }
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      currentStrokePointsRef.current = [];
      return;
    }
    const points = currentStrokePointsRef.current;
    const { x, y } = getPos(e);
    const pressure = typeof e.pressure === "number" ? e.pressure : 0.5;
    points.push([x, y, pressure]);

    const fillStyle = `rgba(26, 26, 26, ${opacity})`;

    if (points.length === 1) {
      // Single-point dot — store as a circular path
      const r = thickness / 2;
      const pathData = `M${x + r},${y} A${r},${r} 0 1,1 ${x - r},${y} A${r},${r} 0 1,1 ${x + r},${y}Z`;
      completedStrokesRef.current.push({ pathData, fillStyle });
    } else {
      const pathData = renderCurrentStroke(points, true);
      if (pathData) {
        completedStrokesRef.current.push({ pathData, fillStyle });
      }
    }

    redrawAll();
    isDrawingRef.current = false;
    currentStrokePointsRef.current = [];
  };

  /** Save current canvas content as a glyph blob (synchronous capture). */
  const saveCurrent = useCallback((): Record<string, Blob> | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContentRef.current) return null;

    // Synchronous capture — avoids race conditions with canvas clearing
    const dataUrl = canvas.toDataURL("image/png");
    const byteStr = atob(dataUrl.split(",")[1]);
    const buf = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) buf[i] = byteStr.charCodeAt(i);
    const blob = new Blob([buf], { type: "image/png" });

    const letter = ALL_LETTERS[currentIndexRef.current];
    const newGlyphs = { ...drawnGlyphsRef.current, [letter]: blob };
    drawnGlyphsRef.current = newGlyphs;
    setDrawnGlyphs(newGlyphs);
    onGlyphsChange?.(newGlyphs);
    setHasContent(false);
    return newGlyphs;
  }, [onGlyphsChange]);

  const saveAndNext = useCallback(() => {
    const newGlyphs = saveCurrent();
    if (!newGlyphs) return;

    // Pick a random undrawn letter next
    const undrawn = ALL_LETTERS
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => !(l in newGlyphs));
    if (undrawn.length > 0) {
      const pick = undrawn[Math.floor(Math.random() * undrawn.length)];
      setCurrentIndex(pick.i);
    } else {
      onComplete(newGlyphs);
    }
  }, [saveCurrent, onComplete]);

  const goToLetter = useCallback((i: number) => {
    if (i === currentIndexRef.current) return;
    saveCurrent();
    setCurrentIndex(i);
  }, [saveCurrent]);

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

  const finishEarly = useCallback(() => {
    // Save current letter if it has content, then complete
    const glyphs = saveCurrent() ?? drawnGlyphsRef.current;
    onComplete(glyphs);
  }, [saveCurrent, onComplete]);

  const canFinish = Object.keys(drawnGlyphs).length > 0 || hasContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto"
    >
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
        className="drawing-canvas w-full aspect-[5/6] rounded-xl border border-border bg-paper relative overflow-hidden"
        style={{ boxShadow: "var(--shadow-md)", maxWidth: "300px", containerType: "size" }}
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
        {/* Typographic guide lines (always visible) */}
        <div
          className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{ top: `${GUIDE_LINES.xHeight * 100}%`, borderColor: 'rgba(0,0,0,0.08)' }}
        />
        <div
          className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{ top: `${GUIDE_LINES.baseline * 100}%`, borderColor: 'rgba(0,0,0,0.12)' }}
        />
        {/* Guide letter (faint) — hides on first stroke */}
        {!hasContent && (
          <span
            className="absolute pointer-events-none select-none font-medium text-ink/[0.04]"
            style={{
              fontSize: GHOST_FONT_SIZE,
              lineHeight: 1,
              left: '50%',
              top: `${GUIDE_LINES.baseline * 100}%`,
              transform: 'translate(-50%, -86%)',
            }}
          >
            {currentLetter}
          </span>
        )}
      </div>

      {/* Thickness slider (always visible) */}
      <div className="flex items-center gap-3 w-full" style={{ maxWidth: "300px" }}>
        <span
          className="block rounded-full bg-fg/40 shrink-0"
          style={{ width: "3px", height: "3px" }}
        />
        <input
          type="range"
          min={1}
          max={40}
          step={1}
          value={thickness}
          onChange={(e) => setThickness(Number(e.target.value))}
          className="w-full h-[2px] appearance-none bg-border rounded-full outline-none
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-fg [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
        />
        <span
          className="block rounded-full bg-fg/40 shrink-0"
          style={{ width: "12px", height: "12px" }}
        />
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
          next
        </button>
        {canFinish && (
          <button
            onClick={finishEarly}
            className="px-5 py-2.5 rounded-full border border-fg/20 text-xs tracking-wide text-fg/50 hover:border-fg/40 hover:text-fg/70 transition-colors"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            finish
          </button>
        )}
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
            onClick={() => goToLetter(i)}
          >
            {letter}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
