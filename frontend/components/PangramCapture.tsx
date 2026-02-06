"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRandomPangram } from "@/lib/pangrams";

interface PangramCaptureProps {
  onCapture: (file: File | Blob, pangram: string) => void;
}

export default function PangramCapture({ onCapture }: PangramCaptureProps) {
  const [pangram, setPangram] = useState(() => getRandomPangram());
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const shufflePangram = () => {
    let next = getRandomPangram();
    while (next === pangram) {
      next = getRandomPangram();
    }
    setPangram(next);
  };

  const handleFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      setPreview(url);
      onCapture(file, pangram);
    },
    [onCapture, pangram]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col items-center gap-8 w-full max-w-lg mx-auto"
    >
      {/* Pangram display */}
      <div className="text-center space-y-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-fg/40">
          write this on paper
        </p>
        <motion.p
          key={pangram}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-lg md:text-xl font-medium leading-relaxed px-4"
        >
          &ldquo;{pangram}&rdquo;
        </motion.p>
        <button
          onClick={shufflePangram}
          className="text-[11px] uppercase tracking-[0.15em] text-fg/35 hover:text-fg/60 transition-colors"
        >
          shuffle &rarr;
        </button>
      </div>

      {/* Capture area */}
      <AnimatePresence mode="wait">
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            <img
              src={preview}
              alt="Captured handwriting"
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setPreview(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-bg/80 backdrop-blur-sm border border-border flex items-center justify-center text-fg/60 hover:text-fg transition-colors text-sm"
            >
              &times;
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="w-full aspect-[4/3] rounded-xl border border-dashed border-border-strong flex flex-col items-center justify-center gap-5 cursor-pointer hover:border-fg/30 transition-colors"
            style={{ boxShadow: "var(--shadow-sm)" }}
            onClick={() => fileInputRef.current?.click()}
          >
            {/* Camera icon */}
            <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-fg/40"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs text-fg/50">
                tap to upload or take a photo
              </p>
              <p className="text-[10px] text-fg/30">
                or drag & drop an image
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Action buttons */}
      {!preview && (
        <div className="flex gap-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="px-5 py-2.5 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            take photo
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            upload image
          </button>
        </div>
      )}
    </motion.div>
  );
}
