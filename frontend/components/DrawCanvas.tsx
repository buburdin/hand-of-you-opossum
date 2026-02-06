"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_LETTERS } from "@/lib/pangrams";

interface DrawCanvasProps {
  onComplete: (glyphImages: Record<string, Blob>) => void;
}

export default function DrawCanvas({ onComplete }: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drawnGlyphs, setDrawnGlyphs] = useState<Record<string, Blob>>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const currentLetter = ALL_LETTERS[currentIndex];
  const progress = Object.keys(drawnGlyphs).length / ALL_LETTERS.length;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    clearCanvas();
  }, [currentIndex]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    // Fill with white so the exported PNG has a white background
    // (transparent pixels decode as black in OpenCV, breaking threshold inversion)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasContent(false);
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasContent(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const saveAndNext = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b!),
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
        className="drawing-canvas w-full aspect-square rounded-xl border border-border bg-white relative overflow-hidden"
        style={{ boxShadow: "var(--shadow-md)", maxWidth: "320px" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {/* Guide letter (faint) */}
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-8xl text-fg/[0.04] font-medium select-none">
              {currentLetter}
            </span>
          </div>
        )}
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
