import { describe, it, expect } from "vitest";
import {
  toGrayscale,
  blur5x5,
  adaptiveThreshold,
  otsuThreshold,
  morphClose,
  removeSmallComponents,
} from "@/lib/pipeline/preprocess";

// Helper to create a simple ImageData-like object
function makeImageData(
  width: number,
  height: number,
  fillFn: (x: number, y: number) => [number, number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fillFn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return new ImageData(data, width, height);
}

describe("toGrayscale", () => {
  it("converts pure white to 255", () => {
    const img = makeImageData(2, 2, () => [255, 255, 255, 255]);
    const gray = toGrayscale(img);
    expect(gray[0]).toBe(255);
    expect(gray[3]).toBe(255);
  });

  it("converts pure black to 0", () => {
    const img = makeImageData(2, 2, () => [0, 0, 0, 255]);
    const gray = toGrayscale(img);
    expect(gray[0]).toBe(0);
  });

  it("converts red using correct luma weights", () => {
    const img = makeImageData(1, 1, () => [255, 0, 0, 255]);
    const gray = toGrayscale(img);
    // 0.299 * 255 ≈ 76
    expect(gray[0]).toBe(76);
  });

  it("converts green using correct luma weights", () => {
    const img = makeImageData(1, 1, () => [0, 255, 0, 255]);
    const gray = toGrayscale(img);
    // 0.587 * 255 ≈ 150
    expect(gray[0]).toBe(150);
  });

  it("has correct length", () => {
    const img = makeImageData(10, 8, () => [128, 128, 128, 255]);
    const gray = toGrayscale(img);
    expect(gray.length).toBe(80);
  });
});

describe("blur5x5", () => {
  it("does not change a uniform image", () => {
    const gray = new Uint8Array(25).fill(100);
    const blurred = blur5x5(gray, 5, 5);
    // Center pixel should still be ~100
    expect(blurred[12]).toBe(100);
  });

  it("smooths a single bright pixel", () => {
    const gray = new Uint8Array(25).fill(0);
    gray[12] = 255; // center pixel
    const blurred = blur5x5(gray, 5, 5);
    // Center should be lower than 255 (averaged with neighbors)
    expect(blurred[12]).toBeLessThan(255);
    expect(blurred[12]).toBeGreaterThan(0);
  });
});

describe("adaptiveThreshold", () => {
  it("produces binary output (only 0 or 255)", () => {
    const w = 30,
      h = 30;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = Math.floor(Math.random() * 256);

    const binary = adaptiveThreshold(gray, w, h, 21, 10);
    for (let i = 0; i < binary.length; i++) {
      expect(binary[i] === 0 || binary[i] === 255).toBe(true);
    }
  });

  it("thresholds dark text on light background (BINARY_INV)", () => {
    const w = 50,
      h = 50;
    // Light background (200) with dark line (50) in the middle
    const gray = new Uint8Array(w * h).fill(200);
    for (let x = 10; x < 40; x++) {
      gray[25 * w + x] = 50; // horizontal dark line
    }

    const binary = adaptiveThreshold(gray, w, h, 21, 10);
    // Pixels on the dark line should be 255 (ink)
    expect(binary[25 * w + 25]).toBe(255);
    // Background pixels should be 0
    expect(binary[0]).toBe(0);
  });
});

describe("otsuThreshold", () => {
  it("produces binary output", () => {
    const gray = new Uint8Array(100);
    for (let i = 0; i < 50; i++) gray[i] = 30; // dark pixels
    for (let i = 50; i < 100; i++) gray[i] = 220; // light pixels

    const { binary, threshold } = otsuThreshold(gray);

    for (let i = 0; i < binary.length; i++) {
      expect(binary[i] === 0 || binary[i] === 255).toBe(true);
    }

    // Threshold should be between the two clusters (inclusive)
    expect(threshold).toBeGreaterThanOrEqual(30);
    expect(threshold).toBeLessThanOrEqual(220);
  });

  it("marks dark pixels as 255 (BINARY_INV)", () => {
    const gray = new Uint8Array(100);
    for (let i = 0; i < 50; i++) gray[i] = 10; // very dark
    for (let i = 50; i < 100; i++) gray[i] = 240; // very light

    const { binary } = otsuThreshold(gray);
    // Dark pixels (ink) → 255
    expect(binary[0]).toBe(255);
    // Light pixels (background) → 0
    expect(binary[99]).toBe(0);
  });
});

describe("morphClose", () => {
  it("fills single-pixel gaps", () => {
    const w = 5,
      h = 5;
    const binary = new Uint8Array(w * h).fill(255);
    binary[12] = 0; // punch a hole in the center

    const closed = morphClose(binary, w, h, 3, 3);
    // The gap should be filled
    expect(closed[12]).toBe(255);
  });

  it("preserves solid interior of large regions", () => {
    // Use a larger image so edges aren't an issue
    const w = 20,
      h = 20;
    const binary = new Uint8Array(w * h).fill(255);

    const closed = morphClose(binary, w, h, 3, 3);
    // Interior pixels should remain 255
    expect(closed[5 * w + 5]).toBe(255);
    expect(closed[10 * w + 10]).toBe(255);
    expect(closed[15 * w + 15]).toBe(255);
  });
});

describe("removeSmallComponents", () => {
  it("removes components smaller than minArea", () => {
    const w = 10,
      h = 10;
    const binary = new Uint8Array(w * h).fill(0);
    // Small component: 2 pixels
    binary[0] = 255;
    binary[1] = 255;
    // Larger component: 10 pixels
    for (let i = 50; i < 60; i++) binary[i] = 255;

    const cleaned = removeSmallComponents(binary, w, h, 5);
    // Small component should be removed
    expect(cleaned[0]).toBe(0);
    expect(cleaned[1]).toBe(0);
    // Large component should remain
    expect(cleaned[55]).toBe(255);
  });

  it("keeps components exactly at minArea", () => {
    const w = 10,
      h = 10;
    const binary = new Uint8Array(w * h).fill(0);
    // Component of exactly 5 pixels
    for (let i = 0; i < 5; i++) binary[i] = 255;

    const cleaned = removeSmallComponents(binary, w, h, 5);
    expect(cleaned[0]).toBe(255);
  });
});
