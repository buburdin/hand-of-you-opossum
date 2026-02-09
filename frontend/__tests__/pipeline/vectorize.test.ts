import { describe, it, expect } from "vitest";
import { extractSvgPaths, extractSvgViewBox } from "@/lib/pipeline/vectorize";

describe("extractSvgPaths", () => {
  it("extracts path d attribute from SVG", () => {
    const svg = `<svg><path d="M0 0 L10 10 Z"/></svg>`;
    const paths = extractSvgPaths(svg);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toBe("M0 0 L10 10 Z");
  });

  it("extracts multiple paths", () => {
    const svg = `<svg>
      <path d="M0 0 L10 0 L10 10 Z"/>
      <path d="M20 20 L30 20 L30 30 Z"/>
    </svg>`;
    const paths = extractSvgPaths(svg);
    expect(paths).toHaveLength(2);
  });

  it("handles potrace-style SVG with attributes", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <path d="M10 10 C20 30 40 30 50 10 Z" fill="#000000" stroke="none"/>
    </svg>`;
    const paths = extractSvgPaths(svg);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain("C20 30 40 30 50 10");
  });

  it("returns empty array for SVG with no paths", () => {
    const svg = `<svg><rect width="10" height="10"/></svg>`;
    expect(extractSvgPaths(svg)).toEqual([]);
  });

  it("skips paths with empty d attribute", () => {
    const svg = `<svg><path d=""/></svg>`;
    expect(extractSvgPaths(svg)).toEqual([]);
  });
});

describe("extractSvgViewBox", () => {
  it("extracts width and height from SVG", () => {
    const svg = `<svg width="200px" height="150px"></svg>`;
    const result = extractSvgViewBox(svg);
    expect(result).toEqual({ width: 200, height: 150 });
  });

  it("extracts dimensions without px suffix", () => {
    const svg = `<svg width="200" height="150"></svg>`;
    const result = extractSvgViewBox(svg);
    expect(result).toEqual({ width: 200, height: 150 });
  });

  it("returns null when no dimensions found", () => {
    const svg = `<svg></svg>`;
    expect(extractSvgViewBox(svg)).toBeNull();
  });
});
