/**
 * Font generation using opentype.js.
 * Creates OTF font files from vectorized glyph SVG paths.
 */

import opentype from "opentype.js";
import type { VectorizedGlyph } from "./vectorize";
import { GUIDE_LINES } from "../pangrams";

// Font metrics
const UNITS_PER_EM = 1000;
const ASCENDER = 800;
const DESCENDER = -200;
const TARGET_HEIGHT = ASCENDER - DESCENDER; // 1000

/**
 * Punctuation metrics: scale relative to TARGET_HEIGHT and vertical offset
 * from the descender line (in font units).
 * yOffset positions the bottom of the glyph's bounding box.
 */
const PUNCTUATION_METRICS: Record<string, { scale: number; yOffset: number }> = {
  ".":  { scale: 0.12, yOffset: 0 },     // baseline
  ",":  { scale: 0.20, yOffset: -80 },    // slightly below baseline
  "-":  { scale: 0.10, yOffset: 250 },    // mid x-height
  "\u2019":  { scale: 0.18, yOffset: 520 },    // near cap height
};

// ─── SVG path parsing ────────────────────────────────────────────────────────

type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
  | { type: "Q"; x: number; y: number; x1: number; y1: number }
  | { type: "Z" };

/**
 * Parse an SVG path `d` attribute into an array of path commands.
 * Handles M, L, C, Q, Z commands (absolute) and m, l, c, q, z (relative).
 * Potrace outputs absolute coordinates, but we handle both for robustness.
 */
export function parseSvgPath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  // Tokenize: split on command letters, keeping the letter
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!tokens) return commands;

  let curX = 0;
  let curY = 0;

  for (const token of tokens) {
    const cmd = token[0];
    // Extract all numbers from the rest
    const nums = (token.slice(1).match(/-?\d+\.?\d*(?:e[+-]?\d+)?/gi) || []).map(
      Number,
    );

    switch (cmd) {
      case "M":
        for (let i = 0; i < nums.length; i += 2) {
          curX = nums[i];
          curY = nums[i + 1];
          commands.push({ type: i === 0 ? "M" : "L", x: curX, y: curY });
        }
        break;
      case "m":
        for (let i = 0; i < nums.length; i += 2) {
          curX += nums[i];
          curY += nums[i + 1];
          commands.push({ type: i === 0 ? "M" : "L", x: curX, y: curY });
        }
        break;
      case "L":
        for (let i = 0; i < nums.length; i += 2) {
          curX = nums[i];
          curY = nums[i + 1];
          commands.push({ type: "L", x: curX, y: curY });
        }
        break;
      case "l":
        for (let i = 0; i < nums.length; i += 2) {
          curX += nums[i];
          curY += nums[i + 1];
          commands.push({ type: "L", x: curX, y: curY });
        }
        break;
      case "H":
        for (const n of nums) {
          curX = n;
          commands.push({ type: "L", x: curX, y: curY });
        }
        break;
      case "h":
        for (const n of nums) {
          curX += n;
          commands.push({ type: "L", x: curX, y: curY });
        }
        break;
      case "V":
        for (const n of nums) {
          curY = n;
          commands.push({ type: "L", x: curX, y: curY });
        }
        break;
      case "v":
        for (const n of nums) {
          curY += n;
          commands.push({ type: "L", x: curX, y: curY });
        }
        break;
      case "C":
        for (let i = 0; i < nums.length; i += 6) {
          commands.push({
            type: "C",
            x1: nums[i],
            y1: nums[i + 1],
            x2: nums[i + 2],
            y2: nums[i + 3],
            x: nums[i + 4],
            y: nums[i + 5],
          });
          curX = nums[i + 4];
          curY = nums[i + 5];
        }
        break;
      case "c":
        for (let i = 0; i < nums.length; i += 6) {
          commands.push({
            type: "C",
            x1: curX + nums[i],
            y1: curY + nums[i + 1],
            x2: curX + nums[i + 2],
            y2: curY + nums[i + 3],
            x: curX + nums[i + 4],
            y: curY + nums[i + 5],
          });
          curX += nums[i + 4];
          curY += nums[i + 5];
        }
        break;
      case "Q":
        for (let i = 0; i < nums.length; i += 4) {
          commands.push({
            type: "Q",
            x1: nums[i],
            y1: nums[i + 1],
            x: nums[i + 2],
            y: nums[i + 3],
          });
          curX = nums[i + 2];
          curY = nums[i + 3];
        }
        break;
      case "q":
        for (let i = 0; i < nums.length; i += 4) {
          commands.push({
            type: "Q",
            x1: curX + nums[i],
            y1: curY + nums[i + 1],
            x: curX + nums[i + 2],
            y: curY + nums[i + 3],
          });
          curX += nums[i + 2];
          curY += nums[i + 3];
        }
        break;
      case "Z":
      case "z":
        commands.push({ type: "Z" });
        break;
      // A (arc) is not used by potrace, skipping
    }
  }

  return commands;
}

// ─── path transformation ──────────────────────────────────────────────────────

/**
 * Compute the bounding box of parsed path commands.
 */
function pathBoundingBox(cmds: PathCommand[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const update = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const cmd of cmds) {
    switch (cmd.type) {
      case "M":
      case "L":
        update(cmd.x, cmd.y);
        break;
      case "Q":
        update(cmd.x, cmd.y);
        update(cmd.x1, cmd.y1);
        break;
      case "C":
        update(cmd.x, cmd.y);
        update(cmd.x1, cmd.y1);
        update(cmd.x2, cmd.y2);
        break;
      case "Z":
        break;
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Transform path commands to font coordinate space.
 *
 * Potrace's raw path coordinates are already Y-UP (via its internal
 * translate+scale transform), so NO Y-flip is needed. We just:
 * - Translate so bounding box starts at the descender
 * - Scale to fit within font units (1000 UPM)
 * - Add left side bearing offset
 *
 * When `referenceHeight` is provided (draw mode), all glyphs use the same
 * scale factor so stroke thickness is consistent across letters.
 */
function transformToFontCoords(
  cmds: PathCommand[],
  sourceWidth: number,
  sourceHeight: number,
  punctuation?: { scale: number; yOffset: number },
  referenceHeight?: number,
): { commands: PathCommand[]; advanceWidth: number; lsb: number } {
  const bbox = pathBoundingBox(cmds);
  const bw = bbox.maxX - bbox.minX;
  const bh = bbox.maxY - bbox.minY;

  if (bw === 0 || bh === 0) {
    return { commands: [], advanceWidth: Math.round(UNITS_PER_EM * 0.5), lsb: 0 };
  }

  // Uniform scaling mode: referenceHeight provided and NOT punctuation
  const useUniformScale = referenceHeight != null && !punctuation;

  // For punctuation, scale to a fraction of the em and position vertically
  // For uniform mode, scale by referenceHeight so all glyphs get identical scale
  const targetH = punctuation ? TARGET_HEIGHT * punctuation.scale : TARGET_HEIGHT;
  const scale = useUniformScale
    ? TARGET_HEIGHT / referenceHeight
    : targetH / Math.max(bh, 1);
  const scaledWidth = Math.round(bw * scale);
  const bearing = Math.round(scaledWidth * 0.12);
  const advanceWidth = scaledWidth + bearing * 2;

  // No Y-flip: potrace raw coords are already Y-UP.
  // Just scale to font units and position within em square.
  let transform: (x: number, y: number) => [number, number];

  if (useUniformScale) {
    // Guide lines don't span the full canvas — account for padding
    const descYFrac = 1 - GUIDE_LINES.descender; // fraction from bottom (potrace Y-up)
    const ascYFrac  = 1 - GUIDE_LINES.ascender;
    const effectiveHeight = (ascYFrac - descYFrac) * referenceHeight;
    const potraceDescY = descYFrac * referenceHeight;
    const uniformScale = TARGET_HEIGHT / effectiveHeight;
    const scaledWidth = Math.round(bw * uniformScale);
    const uniformBearing = Math.round(scaledWidth * 0.12);

    transform = (x: number, y: number): [number, number] => {
      const fx = (x - bbox.minX) * uniformScale + uniformBearing;
      const fy = (y - potraceDescY) * uniformScale + DESCENDER;
      return [Math.round(fx), Math.round(fy)];
    };

    // Return early with correct advanceWidth using the uniform scale
    const uniformAdvanceWidth = scaledWidth + uniformBearing * 2;

    const transformed: PathCommand[] = [];
    for (const cmd of cmds) {
      switch (cmd.type) {
        case "M":
        case "L": {
          const [x, y] = transform(cmd.x, cmd.y);
          transformed.push({ type: cmd.type, x, y });
          break;
        }
        case "C": {
          const [x, y] = transform(cmd.x, cmd.y);
          const [x1, y1] = transform(cmd.x1, cmd.y1);
          const [x2, y2] = transform(cmd.x2, cmd.y2);
          transformed.push({ type: "C", x, y, x1, y1, x2, y2 });
          break;
        }
        case "Q": {
          const [x, y] = transform(cmd.x, cmd.y);
          const [x1, y1] = transform(cmd.x1, cmd.y1);
          transformed.push({ type: "Q", x, y, x1, y1 });
          break;
        }
        case "Z":
          transformed.push({ type: "Z" });
          break;
      }
    }

    return { commands: transformed, advanceWidth: uniformAdvanceWidth, lsb: uniformBearing };
  } else {
    const yBase = punctuation ? DESCENDER + punctuation.yOffset : DESCENDER;
    transform = (x: number, y: number): [number, number] => {
      const fx = (x - bbox.minX) * scale + bearing;
      const fy = (y - bbox.minY) * scale + yBase;
      return [Math.round(fx), Math.round(fy)];
    };
  }

  const transformed: PathCommand[] = [];
  for (const cmd of cmds) {
    switch (cmd.type) {
      case "M":
      case "L": {
        const [x, y] = transform(cmd.x, cmd.y);
        transformed.push({ type: cmd.type, x, y });
        break;
      }
      case "C": {
        const [x, y] = transform(cmd.x, cmd.y);
        const [x1, y1] = transform(cmd.x1, cmd.y1);
        const [x2, y2] = transform(cmd.x2, cmd.y2);
        transformed.push({ type: "C", x, y, x1, y1, x2, y2 });
        break;
      }
      case "Q": {
        const [x, y] = transform(cmd.x, cmd.y);
        const [x1, y1] = transform(cmd.x1, cmd.y1);
        transformed.push({ type: "Q", x, y, x1, y1 });
        break;
      }
      case "Z":
        transformed.push({ type: "Z" });
        break;
    }
  }

  return { commands: transformed, advanceWidth, lsb: bearing };
}

// ─── opentype.js glyph building ──────────────────────────────────────────────

/**
 * Convert parsed & transformed path commands into an opentype.js Path object.
 */
function commandsToOpentypePath(cmds: PathCommand[]): opentype.Path {
  const path = new opentype.Path();

  for (const cmd of cmds) {
    switch (cmd.type) {
      case "M":
        path.moveTo(cmd.x, cmd.y);
        break;
      case "L":
        path.lineTo(cmd.x, cmd.y);
        break;
      case "C":
        path.curveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        break;
      case "Q":
        path.quadTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
        break;
      case "Z":
        path.closePath();
        break;
    }
  }

  return path;
}

// ─── public API ───────────────────────────────────────────────────────────────

export interface FontResult {
  /** OTF font as ArrayBuffer (usable with FontFace API and for download) */
  ttf: ArrayBuffer;
  /** Characters that were included in the font */
  charsFound: string[];
}

/**
 * Generate an OTF font from vectorized glyph data.
 *
 * @param glyphs Map of character → VectorizedGlyph (SVG path data from potrace)
 * @param familyName Font family name
 * @param referenceHeight When provided (draw mode), all non-punctuation glyphs
 *   use the same scale factor for consistent stroke thickness
 * @returns Font ArrayBuffer and metadata
 */
export function generateFont(
  glyphs: Record<string, VectorizedGlyph>,
  familyName = "MyHandwriting",
  referenceHeight?: number,
): FontResult {
  // .notdef glyph (required)
  const notdefPath = new opentype.Path();
  notdefPath.moveTo(100, 0);
  notdefPath.lineTo(100, 700);
  notdefPath.lineTo(500, 700);
  notdefPath.lineTo(500, 0);
  notdefPath.closePath();
  // Inner cutout
  notdefPath.moveTo(150, 50);
  notdefPath.lineTo(450, 50);
  notdefPath.lineTo(450, 650);
  notdefPath.lineTo(150, 650);
  notdefPath.closePath();

  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: 600,
    path: notdefPath,
  });

  // Space glyph
  const spaceGlyph = new opentype.Glyph({
    name: "space",
    unicode: 32,
    advanceWidth: Math.round(UNITS_PER_EM / 4),
    path: new opentype.Path(),
  });

  const fontGlyphs: opentype.Glyph[] = [notdefGlyph, spaceGlyph];
  const charsFound: string[] = [];

  // Process each character
  for (const char of Object.keys(glyphs).sort()) {
    const glyph = glyphs[char];

    // Combine all SVG path strings for this character
    let allCommands: PathCommand[] = [];
    for (const pathD of glyph.paths) {
      allCommands = allCommands.concat(parseSvgPath(pathD));
    }

    if (allCommands.length === 0) continue;

    // Transform to font coordinate space
    const { commands, advanceWidth } = transformToFontCoords(
      allCommands,
      glyph.sourceWidth,
      glyph.sourceHeight,
      PUNCTUATION_METRICS[char],
      referenceHeight,
    );

    if (commands.length === 0) continue;

    // Build opentype.js path
    const path = commandsToOpentypePath(commands);

    // Create glyph for lowercase
    const lowerCode = char.toLowerCase().charCodeAt(0);
    const glyphObj = new opentype.Glyph({
      name: char.toLowerCase(),
      unicode: lowerCode,
      advanceWidth,
      path,
    });
    fontGlyphs.push(glyphObj);

    // Create glyph for uppercase (same path, different unicode)
    if (char.toLowerCase() !== char.toUpperCase()) {
      const upperCode = char.toUpperCase().charCodeAt(0);
      const upperGlyph = new opentype.Glyph({
        name: char.toUpperCase(),
        unicode: upperCode,
        advanceWidth,
        path,
      });
      fontGlyphs.push(upperGlyph);
    }

    charsFound.push(char.toLowerCase());
  }

  if (charsFound.length === 0) {
    throw new Error("No valid glyphs could be extracted");
  }

  // Create font
  const font = new opentype.Font({
    familyName,
    styleName: "Regular",
    unitsPerEm: UNITS_PER_EM,
    ascender: ASCENDER,
    descender: DESCENDER,
    glyphs: fontGlyphs,
  });

  return {
    ttf: font.toArrayBuffer(),
    charsFound,
  };
}
