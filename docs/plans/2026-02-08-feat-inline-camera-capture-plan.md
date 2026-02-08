---
title: Inline Camera Capture with Live Preview
type: feat
date: 2026-02-08
---

# Inline Camera Capture with Live Preview

Replace the current system file picker (`<input capture="environment">`) with an in-app live camera preview using `getUserMedia`. The user sees a real-time video feed and taps a shutter button to capture the photo of their handwritten pangram.

## Acceptance Criteria

- [x] Clicking "take photo" opens a live camera preview inside the existing capture area (replaces the dropzone)
- [x] Default camera is rear-facing (`facingMode: { ideal: "environment" }`) since users photograph paper
- [x] Shutter button captures a frame and shows it as a preview (same as current post-upload preview)
- [x] "Retake" dismisses the preview and resumes the live feed
- [x] "Use photo" calls existing `onCapture(file, pangram)` with the captured JPEG blob
- [x] Camera stream is properly stopped on unmount and when leaving camera mode
- [x] Graceful fallback: if `getUserMedia` is unavailable (in-app browsers, HTTP, no camera), silently fall back to the current `<input capture="environment">` behavior
- [x] `playsInline` and `muted` attributes on `<video>` for iOS Safari compatibility
- [x] Permission denied state shows a helpful message with fallback to file upload
- [x] Animations match existing app style (Framer Motion spring transitions)

## Context

**Current behavior** (`PangramCapture.tsx`):
- "take photo" button triggers a hidden `<input type="file" capture="environment">`
- On mobile this opens the system camera app; on desktop it opens a file picker
- After selection, the image previews inline and `onCapture` is called

**New behavior**:
- "take photo" button opens an inline `<video>` stream with shutter UI
- The dropzone area (aspect-[4/3]) becomes the viewfinder
- Capture produces a JPEG blob via hidden `<canvas>` + `toBlob()`
- "upload image" button remains unchanged (file picker)

**Key technical notes**:
- Use `useEffect` for stream init (SSR guard — `navigator.mediaDevices` is undefined on server)
- Use `video.videoWidth/videoHeight` for canvas dimensions (not CSS size) to get full resolution
- `toBlob("image/jpeg", 0.92)` for good quality/size balance
- Wrap the `File` constructor around the blob for `onCapture` compatibility
- Stop all tracks via `stream.getTracks().forEach(t => t.stop())` on cleanup
- Handle `NotAllowedError`, `NotFoundError`, `NotReadableError` from `getUserMedia`

## MVP

### components/CameraCapture.tsx

New component replacing the dropzone when camera is active:

```tsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

// States: initializing → active → captured
// Error states: denied, not-found, not-supported, error

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"initializing" | "active" | "captured" | "denied" | "not-found" | "not-supported" | "error">("initializing");
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

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
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStatus("active");
      } catch (err) {
        if (cancelled) return;
        const e = err as DOMException;
        if (e.name === "NotAllowedError") setStatus("denied");
        else if (e.name === "NotFoundError") setStatus("not-found");
        else setStatus("error");
      }
    }

    init();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Capture frame
  const handleShutter = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setPreview(URL.createObjectURL(blob));
      setStatus("captured");
      // Pause stream while previewing
      video.pause();
    }, "image/jpeg", 0.92);
  }, []);

  // Retake
  const handleRetake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCapturedBlob(null);
    setStatus("active");
    videoRef.current?.play().catch(() => {});
  }, [preview]);

  // Use photo
  const handleUse = useCallback(() => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
  }, [capturedBlob, onCapture]);

  // Render based on status...
  // - "initializing": spinner in the 4/3 area
  // - "active": <video> + shutter button
  // - "captured": <img preview> + retake/use buttons
  // - "denied"/"not-found"/"not-supported"/"error": message + fallback button
}
```

### Changes to components/PangramCapture.tsx

Add a `cameraActive` state. When true, render `<CameraCapture>` instead of the dropzone. The "take photo" button sets `cameraActive = true`. Fallback: if camera not supported, keep current `cameraInputRef.click()` behavior.

```tsx
// New state
const [cameraActive, setCameraActive] = useState(false);
const cameraSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

// "take photo" button handler
onClick={() => cameraSupported ? setCameraActive(true) : cameraInputRef.current?.click()}

// In the AnimatePresence, add a third state for camera mode:
// cameraActive ? <CameraCapture onCapture={...} onClose={() => setCameraActive(false)} />
// : preview ? <preview UI> : <dropzone>
```

## References

- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: Taking Still Photos](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Taking_still_photos)
- Existing component: `frontend/components/PangramCapture.tsx`
- API integration: `frontend/lib/api.ts` — `processPangram(file, pangram)` accepts `File | Blob`
