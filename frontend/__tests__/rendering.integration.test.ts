import { describe, it, expect, beforeEach, vi } from "vitest";
import opentype from "opentype.js";
import { generateFont } from "@/lib/pipeline/fontgen";
import type { VectorizedGlyph } from "@/lib/pipeline/vectorize";

// ─── Mock FontFace ────────────────────────────────────────────────────────────

class MockFontFace {
  family: string;
  source: string;
  status: string = "unloaded";
  constructor(family: string, source: string) {
    this.family = family;
    this.source = source;
  }
  async load(): Promise<MockFontFace> {
    this.status = "loaded";
    return this;
  }
}

const fontsSet = new Set<MockFontFace>();
Object.defineProperty(document, "fonts", {
  value: {
    add: (face: MockFontFace) => fontsSet.add(face),
    delete: (face: MockFontFace) => fontsSet.delete(face),
    [Symbol.iterator]: () => fontsSet[Symbol.iterator](),
  },
  writable: true,
  configurable: true,
});
(globalThis as Record<string, unknown>).FontFace = MockFontFace;

import { loadFont, getFontEmbedCSS, getFontFamilyName } from "@/lib/fontLoader";

// ─── Integration tests ───────────────────────────────────────────────────────

describe("End-to-end rendering pipeline", () => {
  beforeEach(() => {
    fontsSet.clear();
  });

  it("generates font → loads it → produces valid embed CSS for html-to-image", async () => {
    // Step 1: Generate a font with a known glyph
    const glyphs: Record<string, VectorizedGlyph> = {
      a: {
        paths: ["M10 10 L90 10 L90 90 L10 90 Z"],
        sourceWidth: 100,
        sourceHeight: 100,
      },
      b: {
        paths: ["M10 10 C50 90 90 90 90 10 Z"],
        sourceWidth: 100,
        sourceHeight: 100,
      },
    };

    const fontResult = generateFont(glyphs, "TestHandwriting");
    expect(fontResult.ttf.byteLength).toBeGreaterThan(0);
    expect(fontResult.charsFound).toContain("a");
    expect(fontResult.charsFound).toContain("b");

    // Step 2: Verify the font can be parsed back
    const parsed = opentype.parse(fontResult.ttf);
    expect(parsed.glyphs.length).toBeGreaterThanOrEqual(4); // .notdef + space + a + A + b + B

    // Verify "a" glyph has valid path
    const aGlyph = parsed.charToGlyph("a");
    expect(aGlyph.name).not.toBe(".notdef");
    const aPath = aGlyph.getPath(0, 0, 72);
    expect(aPath.commands.length).toBeGreaterThan(0);

    // Verify "b" glyph has curves (from cubic bezier input)
    const bGlyph = parsed.charToGlyph("b");
    const bPath = bGlyph.getPath(0, 0, 72);
    const hasCurve = bPath.commands.some((c: { type: string }) => c.type === "C");
    expect(hasCurve).toBe(true);

    // Step 3: Load into FontFace API
    const familyName = await loadFont(fontResult.ttf);
    expect(familyName).toBe("UserHandwriting");

    // Step 4: Get embed CSS for html-to-image
    const css = getFontEmbedCSS();
    expect(css).not.toBeNull();

    // Verify CSS structure
    expect(css).toContain("@font-face");
    expect(css).toContain(`"${getFontFamilyName()}"`);
    expect(css).toContain('format("truetype")');
    expect(css).not.toContain('format("woff2")');

    // Verify the embedded font data is valid
    const dataUrlMatch = css!.match(/url\((data:[^)]+)\)/);
    expect(dataUrlMatch).not.toBeNull();

    const dataUrl = dataUrlMatch![1];
    const base64Part = dataUrl.split(",")[1];

    // Decode the base64 and verify it's a valid font
    const decoded = atob(base64Part);
    const buf = new ArrayBuffer(decoded.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < decoded.length; i++) {
      view[i] = decoded.charCodeAt(i);
    }

    // Parse the embedded font to verify it survived base64 encoding
    const embeddedFont = opentype.parse(buf);
    expect(embeddedFont.glyphs.length).toBeGreaterThanOrEqual(4);
    const embeddedA = embeddedFont.charToGlyph("a");
    expect(embeddedA.name).not.toBe(".notdef");
  });

  it("sticky note scenario: font renders lowercase and uppercase correctly", async () => {
    // Generate a font with distinct glyphs
    const glyphs: Record<string, VectorizedGlyph> = {};
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(97 + i);
      // Each letter gets a slightly different rectangle
      const size = 60 + i * 3;
      glyphs[char] = {
        paths: [`M0 0 L${size} 0 L${size} ${size} L0 ${size} Z`],
        sourceWidth: size,
        sourceHeight: size,
      };
    }

    const result = generateFont(glyphs);
    await loadFont(result.ttf);

    // Verify all letters are accessible
    const parsed = opentype.parse(result.ttf);
    for (let i = 0; i < 26; i++) {
      const lower = String.fromCharCode(97 + i);
      const upper = String.fromCharCode(65 + i);

      const lowerGlyph = parsed.charToGlyph(lower);
      const upperGlyph = parsed.charToGlyph(upper);

      expect(lowerGlyph.name).not.toBe(".notdef");
      expect(upperGlyph.name).not.toBe(".notdef");
    }

    // Verify embed CSS works
    const css = getFontEmbedCSS();
    expect(css).toContain('format("truetype")');
    expect(css).toContain("data:font/sfnt;base64,");
  });

  it("font has correct metrics (ascender, descender, unitsPerEm)", async () => {
    const glyphs: Record<string, VectorizedGlyph> = {
      a: {
        paths: ["M10 10 L90 10 L90 90 L10 90 Z"],
        sourceWidth: 100,
        sourceHeight: 100,
      },
    };

    const result = generateFont(glyphs);
    const parsed = opentype.parse(result.ttf);

    expect(parsed.unitsPerEm).toBe(1000);
    expect(parsed.ascender).toBe(800);
    expect(parsed.descender).toBe(-200);
  });
});
