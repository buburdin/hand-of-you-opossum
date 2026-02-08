"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type CameraStatus =
  | "initializing"
  | "active"
  | "captured"
  | "denied"
  | "not-found"
  | "not-supported"
  | "error";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export default function CameraCapture({
  onCapture,
  onClose,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("initializing");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [flash, setFlash] = useState(false);

  // Initialize camera stream
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("not-supported");
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        setStatus("active");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError") setStatus("denied");
          else if (err.name === "NotFoundError") setStatus("not-found");
          else setStatus("error");
        } else {
          setStatus("error");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleShutter = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    setFlash(true);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("captured");
        // Stop camera stream to save battery
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      },
      "image/jpeg",
      0.80
    );
  }, []);

  const handleRetake = useCallback(async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedBlob(null);
    setFlash(false);

    // Re-initialize camera stream
    setStatus("initializing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setStatus("active");
    } catch {
      setStatus("error");
    }
  }, [previewUrl]);

  const handleUse = useCallback(() => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
  }, [capturedBlob, onCapture]);

  const isError =
    status === "denied" ||
    status === "not-found" ||
    status === "not-supported" ||
    status === "error";

  return (
    <motion.div
      key="camera"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={spring}
      className="w-full flex flex-col items-center gap-5"
    >
      {/* Viewfinder / Preview / Error */}
      <div
        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border bg-black/5"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        {/* Live video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            status === "captured" ? "hidden" : ""
          }`}
        />

        {/* Captured preview */}
        <AnimatePresence>
          {status === "captured" && previewUrl && (
            <motion.img
              key="captured-preview"
              src={previewUrl}
              alt="Captured handwriting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </AnimatePresence>

        {/* Flash effect */}
        <AnimatePresence>
          {flash && (
            <motion.div
              key="flash"
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onAnimationComplete={() => setFlash(false)}
              className="absolute inset-0 bg-white pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Initializing spinner */}
        {status === "initializing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-6 h-6 border-2 border-fg/20 border-t-fg/60 rounded-full"
            />
            <p className="text-[10px] uppercase tracking-[0.2em] text-fg/40">
              starting camera&hellip;
            </p>
          </div>
        )}

        {/* Error states */}
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
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
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs text-fg/50">
                {status === "denied" &&
                  "camera access was denied. please allow camera in your browser settings."}
                {status === "not-found" &&
                  "no camera found on this device."}
                {status === "not-supported" &&
                  "camera is not supported in this browser."}
                {status === "error" &&
                  "something went wrong with the camera."}
              </p>
            </div>
          </div>
        )}

        {/* Close button (always visible) */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-bg/80 backdrop-blur-sm border border-border flex items-center justify-center text-fg/60 hover:text-fg transition-colors text-sm"
        >
          &times;
        </button>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Action buttons */}
      <div className="flex gap-3">
        {status === "active" && (
          <motion.button
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            onClick={handleShutter}
            className="w-14 h-14 rounded-full border-[3px] border-fg/80 flex items-center justify-center hover:border-fg transition-colors"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            <div className="w-10 h-10 rounded-full bg-fg/80 hover:bg-fg transition-colors" />
          </motion.button>
        )}

        {status === "captured" && (
          <>
            <motion.button
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={spring}
              onClick={handleRetake}
              className="px-5 py-2.5 rounded-full border border-border text-xs tracking-wide hover:border-fg/30 transition-colors"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              retake
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={spring}
              onClick={handleUse}
              className="px-5 py-2.5 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              use photo
            </motion.button>
          </>
        )}

        {isError && (
          <motion.button
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-fg text-bg text-xs tracking-wide hover:bg-fg/85 transition-colors"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            upload instead
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
