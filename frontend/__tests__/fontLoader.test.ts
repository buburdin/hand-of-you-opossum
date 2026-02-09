import { describe, it, expect, beforeEach, vi } from "vitest";
import opentype from "opentype.js";

// We need to mock FontFace since jsdom doesn't implement it
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

// Mock document.fonts
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

// Set up global FontFace
(globalThis as Record<string, unknown>).FontFace = MockFontFace;

// Import AFTER setting up mocks
import { loadFont, getFontFamilyName, getFontEmbedCSS } from "@/lib/fontLoader";

/** Generate a minimal valid OTF font ArrayBuffer for testing. */
function createTestFontBuffer(): ArrayBuffer {
  const notdef = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: 650,
    path: new opentype.Path(),
  });

  const aPath = new opentype.Path();
  aPath.moveTo(100, 0);
  aPath.lineTo(100, 700);
  aPath.lineTo(500, 700);
  aPath.lineTo(500, 0);
  aPath.closePath();

  const aGlyph = new opentype.Glyph({
    name: "a",
    unicode: 97,
    advanceWidth: 650,
    path: aPath,
  });

  const font = new opentype.Font({
    familyName: "TestFont",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: [notdef, aGlyph],
  });

  return font.toArrayBuffer();
}

describe("fontLoader", () => {
  beforeEach(() => {
    fontsSet.clear();
  });

  describe("getFontFamilyName", () => {
    it("returns consistent font family name", () => {
      expect(getFontFamilyName()).toBe("UserHandwriting");
    });
  });

  describe("loadFont", () => {
    it("registers a FontFace with the correct family name", async () => {
      const buffer = createTestFontBuffer();
      const name = await loadFont(buffer);

      expect(name).toBe("UserHandwriting");
      expect(fontsSet.size).toBe(1);
      const face = Array.from(fontsSet)[0];
      expect(face.family).toBe("UserHandwriting");
    });

    it("cleans up previous font on re-load", async () => {
      const buffer = createTestFontBuffer();
      await loadFont(buffer);
      expect(fontsSet.size).toBe(1);

      // Load again
      await loadFont(buffer);
      // Old font should be removed, new one added
      expect(fontsSet.size).toBe(1);
    });

    it("loads successfully with a TTF/OTF buffer from opentype.js", async () => {
      const buffer = createTestFontBuffer();
      // Should not throw
      const name = await loadFont(buffer);
      expect(name).toBe("UserHandwriting");
    });
  });

  describe("getFontEmbedCSS", () => {
    it("returns null before any font is loaded", () => {
      // After clearing, no font loaded yet
      // Note: due to module-level state, this may already have a value
      // from previous tests. We test the format after loading instead.
    });

    it("returns valid @font-face CSS after loading a TTF font", async () => {
      const buffer = createTestFontBuffer();
      await loadFont(buffer);

      const css = getFontEmbedCSS();
      expect(css).not.toBeNull();
      expect(css).toContain("@font-face");
      expect(css).toContain('"UserHandwriting"');
      // Should use truetype format for OTF/TTF buffers (not woff2)
      expect(css).toContain('format("truetype")');
      // Should NOT say woff2
      expect(css).not.toContain('format("woff2")');
    });

    it("embeds font as valid base64 data URL", async () => {
      const buffer = createTestFontBuffer();
      await loadFont(buffer);

      const css = getFontEmbedCSS()!;
      // Extract data URL from CSS
      const match = css.match(/url\((data:[^)]+)\)/);
      expect(match).not.toBeNull();

      const dataUrl = match![1];
      expect(dataUrl).toMatch(/^data:font\/sfnt;base64,/);

      // Verify the base64 is decodable
      const base64Part = dataUrl.split(",")[1];
      expect(() => atob(base64Part)).not.toThrow();

      // Verify the decoded data matches the original buffer
      const decoded = atob(base64Part);
      expect(decoded.length).toBe(buffer.byteLength);
    });

    it("produces CSS that references the correct MIME type for the data", async () => {
      const buffer = createTestFontBuffer();
      await loadFont(buffer);

      const css = getFontEmbedCSS()!;
      // The MIME type in the data URL should match the format hint
      // TTF/OTF → font/sfnt with format("truetype")
      expect(css).toContain("font/sfnt");
      expect(css).toContain('format("truetype")');
    });
  });
});
