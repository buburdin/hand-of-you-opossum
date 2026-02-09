import { describe, it, expect } from "vitest";
import opentype from "opentype.js";
import {
  parseSvgPath,
  generateFont,
} from "@/lib/pipeline/fontgen";
import type { VectorizedGlyph } from "@/lib/pipeline/vectorize";

// ─── SVG path parsing ────────────────────────────────────────────────────────

describe("parseSvgPath", () => {
  it("parses absolute MoveTo and LineTo commands", () => {
    const cmds = parseSvgPath("M10 20 L30 40 L50 60 Z");
    expect(cmds).toEqual([
      { type: "M", x: 10, y: 20 },
      { type: "L", x: 30, y: 40 },
      { type: "L", x: 50, y: 60 },
      { type: "Z" },
    ]);
  });

  it("parses relative moveto and lineto commands", () => {
    const cmds = parseSvgPath("m10 20 l5 5 l10 0 z");
    expect(cmds).toEqual([
      { type: "M", x: 10, y: 20 },
      { type: "L", x: 15, y: 25 },
      { type: "L", x: 25, y: 25 },
      { type: "Z" },
    ]);
  });

  it("parses cubic Bezier curves (C command)", () => {
    const cmds = parseSvgPath("M0 0 C10 20 30 40 50 60 Z");
    expect(cmds).toHaveLength(3);
    expect(cmds[1]).toEqual({
      type: "C",
      x1: 10,
      y1: 20,
      x2: 30,
      y2: 40,
      x: 50,
      y: 60,
    });
  });

  it("parses relative cubic Bezier curves (c command)", () => {
    const cmds = parseSvgPath("M100 100 c10 20 30 40 50 60 Z");
    expect(cmds[1]).toEqual({
      type: "C",
      x1: 110,
      y1: 120,
      x2: 130,
      y2: 140,
      x: 150,
      y: 160,
    });
  });

  it("parses quadratic Bezier curves (Q command)", () => {
    const cmds = parseSvgPath("M0 0 Q25 50 50 0 Z");
    expect(cmds[1]).toEqual({
      type: "Q",
      x1: 25,
      y1: 50,
      x: 50,
      y: 0,
    });
  });

  it("parses H and V commands", () => {
    const cmds = parseSvgPath("M0 0 H100 V200 Z");
    expect(cmds).toEqual([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 100, y: 0 },
      { type: "L", x: 100, y: 200 },
      { type: "Z" },
    ]);
  });

  it("parses potrace-style SVG path (real example)", () => {
    // Simplified potrace output for a small square
    const d =
      "M10 10 C10 10 10 50 10 50 C10 50 50 50 50 50 C50 50 50 10 50 10 C50 10 10 10 10 10 Z";
    const cmds = parseSvgPath(d);
    expect(cmds.length).toBeGreaterThanOrEqual(5); // M + 4 curves + Z
    expect(cmds[0].type).toBe("M");
    expect(cmds[cmds.length - 1].type).toBe("Z");
  });

  it("handles negative coordinates", () => {
    const cmds = parseSvgPath("M-10 -20 L-30 -40 Z");
    expect(cmds[0]).toEqual({ type: "M", x: -10, y: -20 });
    expect(cmds[1]).toEqual({ type: "L", x: -30, y: -40 });
  });

  it("handles decimal coordinates", () => {
    const cmds = parseSvgPath("M1.5 2.5 L3.75 4.25 Z");
    expect(cmds[0]).toEqual({ type: "M", x: 1.5, y: 2.5 });
    expect(cmds[1]).toEqual({ type: "L", x: 3.75, y: 4.25 });
  });

  it("returns empty array for empty string", () => {
    expect(parseSvgPath("")).toEqual([]);
  });

  it("handles implicit lineTo after moveTo (multiple coords after M)", () => {
    const cmds = parseSvgPath("M10 20 30 40 50 60");
    expect(cmds).toEqual([
      { type: "M", x: 10, y: 20 },
      { type: "L", x: 30, y: 40 },
      { type: "L", x: 50, y: 60 },
    ]);
  });
});

// ─── Font generation ─────────────────────────────────────────────────────────

describe("generateFont", () => {
  function makeSquareGlyph(size = 100): VectorizedGlyph {
    return {
      paths: [`M0 0 L${size} 0 L${size} ${size} L0 ${size} Z`],
      sourceWidth: size,
      sourceHeight: size,
    };
  }

  it("generates a valid font ArrayBuffer", () => {
    const glyphs: Record<string, VectorizedGlyph> = {
      a: makeSquareGlyph(),
    };

    const result = generateFont(glyphs);
    expect(result.ttf).toBeInstanceOf(ArrayBuffer);
    expect(result.ttf.byteLength).toBeGreaterThan(100);
    expect(result.charsFound).toContain("a");
  });

  it("round-trips: generated font can be parsed back with opentype.js", () => {
    const glyphs: Record<string, VectorizedGlyph> = {
      a: makeSquareGlyph(100),
      b: makeSquareGlyph(80),
      c: makeSquareGlyph(120),
    };

    const result = generateFont(glyphs, "TestHandwriting");
    const parsed = opentype.parse(result.ttf);

    // Font was created with correct name
    expect(parsed.names.fontFamily).toBeDefined();

    // Has at least .notdef + space + 3 lowercase + 3 uppercase glyphs
    expect(parsed.glyphs.length).toBeGreaterThanOrEqual(8);

    // Can look up lowercase glyphs
    const aGlyph = parsed.charToGlyph("a");
    expect(aGlyph).toBeTruthy();
    expect(aGlyph.name).not.toBe(".notdef");

    // Can look up uppercase (mapped to same glyph)
    const AGlyph = parsed.charToGlyph("A");
    expect(AGlyph).toBeTruthy();
    expect(AGlyph.name).not.toBe(".notdef");
  });

  it("generates reasonable advance widths", () => {
    const glyphs: Record<string, VectorizedGlyph> = {
      a: makeSquareGlyph(100),
    };

    const result = generateFont(glyphs);
    const parsed = opentype.parse(result.ttf);
    const aGlyph = parsed.charToGlyph("a");

    // Advance width should be > 0 and <= unitsPerEm * 2
    expect(aGlyph.advanceWidth).toBeGreaterThan(0);
    expect(aGlyph.advanceWidth).toBeLessThanOrEqual(2000);
  });

  it("handles cubic bezier paths (from potrace)", () => {
    const curveGlyph: VectorizedGlyph = {
      paths: ["M0 0 C30 100 70 100 100 0 L100 100 L0 100 Z"],
      sourceWidth: 100,
      sourceHeight: 100,
    };

    const result = generateFont({ a: curveGlyph });
    expect(result.ttf.byteLength).toBeGreaterThan(100);

    // Parse back and verify it has curves
    const parsed = opentype.parse(result.ttf);
    const aGlyph = parsed.charToGlyph("a");
    const path = aGlyph.getPath(0, 0, 72);
    // Should have at least one cubic curve command
    const hasCurve = path.commands.some((c: { type: string }) => c.type === "C");
    expect(hasCurve).toBe(true);
  });

  it("includes all 26 letters when provided", () => {
    const glyphs: Record<string, VectorizedGlyph> = {};
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(97 + i); // a-z
      glyphs[char] = makeSquareGlyph(80 + i * 2);
    }

    const result = generateFont(glyphs);
    expect(result.charsFound).toHaveLength(26);
    expect(result.charsFound.sort()).toEqual(
      "abcdefghijklmnopqrstuvwxyz".split(""),
    );

    const parsed = opentype.parse(result.ttf);
    // .notdef + space + 26 lowercase + 26 uppercase = 54
    expect(parsed.glyphs.length).toBe(54);
  });

  it("throws when no valid glyphs are provided", () => {
    expect(() => generateFont({})).toThrow("No valid glyphs");
  });

  it("throws when paths are empty", () => {
    const glyphs: Record<string, VectorizedGlyph> = {
      a: { paths: [], sourceWidth: 100, sourceHeight: 100 },
    };
    expect(() => generateFont(glyphs)).toThrow("No valid glyphs");
  });
});
