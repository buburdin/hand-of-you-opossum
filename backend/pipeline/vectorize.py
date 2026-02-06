"""Bitmap-to-vector conversion for font glyph creation."""

import cv2
import numpy as np
from typing import List, Tuple

# Font units per em (standard)
UNITS_PER_EM = 1000
ASCENDER = 800
DESCENDER = -200


def bitmap_to_contours(binary: np.ndarray) -> list[np.ndarray]:
    """
    Convert a binary bitmap to OpenCV contours.
    Returns the contours as polygon approximations suitable for font paths.
    """
    contours, hierarchy = cv2.findContours(
        binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_L1
    )
    return contours, hierarchy


def contours_to_font_paths(
    contours: list[np.ndarray],
    hierarchy: np.ndarray,
    target_height: int = ASCENDER - DESCENDER,
) -> list[dict]:
    """
    Convert OpenCV contours to font path commands.
    
    Each contour becomes a series of moveTo/lineTo/closePath commands.
    Coordinates are scaled to font units (1000 UPM).
    
    Returns a list of path command dicts compatible with fontTools pen API.
    """
    if not contours or hierarchy is None:
        return []

    # Find the bounding box of all contours together
    all_points = np.vstack(contours)
    bx, by, bw, bh = cv2.boundingRect(all_points)

    if bw == 0 or bh == 0:
        return []

    # Scale factor to normalize to font units
    scale = target_height / max(bh, 1)

    commands = []

    for i, contour in enumerate(contours):
        if len(contour) < 3:
            continue

        # Simplify contour
        epsilon = 0.5  # Approximation accuracy in pixels
        approx = cv2.approxPolyDP(contour, epsilon, True)

        if len(approx) < 3:
            continue

        # Determine if this is an outer or inner (hole) contour
        h = hierarchy[0][i]
        is_hole = h[3] != -1  # has a parent = is a hole

        points = approx.reshape(-1, 2).astype(float)

        # Transform coordinates:
        # - Translate so bounding box starts at origin
        # - Scale to font units
        # - Flip Y axis (font coordinates: Y goes up, bitmap: Y goes down)
        transformed = []
        for px, py in points:
            fx = (px - bx) * scale
            fy = target_height - (py - by) * scale + DESCENDER
            transformed.append((round(fx), round(fy)))

        # TrueType winding convention:
        # Outer contours must be clockwise (negative signed area)
        # Holes must be counter-clockwise (positive signed area)
        area = polygon_area(transformed)
        if (not is_hole and area > 0) or (is_hole and area < 0):
            transformed.reverse()

        commands.append({
            "points": transformed,
            "is_hole": is_hole,
        })

    return commands


def polygon_area(points: list[tuple[int, int]]) -> float:
    """Calculate signed area of a polygon. Positive = CCW, Negative = CW."""
    n = len(points)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += points[i][0] * points[j][1]
        area -= points[j][0] * points[i][1]
    return area / 2.0


def calculate_advance_width(
    contours: list[np.ndarray],
    bitmap_height: int,
    target_height: int = ASCENDER - DESCENDER,
) -> int:
    """Calculate the advance width for a glyph based on its bounding box."""
    if not contours:
        return round(UNITS_PER_EM * 0.5)

    all_points = np.vstack(contours)
    _, _, bw, bh = cv2.boundingRect(all_points)

    scale = target_height / max(bh, 1)
    width = round(bw * scale)

    # Add some side bearing
    bearing = round(width * 0.15)
    return width + bearing * 2


def process_glyph_bitmap(binary: np.ndarray) -> dict:
    """
    Full pipeline for a single glyph bitmap -> font path data.
    
    Returns dict with:
        - paths: list of path command groups
        - advance_width: calculated advance width in font units
        - lsb: left side bearing
    """
    contours, hierarchy = bitmap_to_contours(binary)

    if not contours or hierarchy is None:
        return {
            "paths": [],
            "advance_width": round(UNITS_PER_EM * 0.5),
            "lsb": 0,
        }

    paths = contours_to_font_paths(contours, hierarchy)

    all_points = np.vstack(contours)
    _, _, bw, bh = cv2.boundingRect(all_points)
    scale = (ASCENDER - DESCENDER) / max(bh, 1)

    raw_width = round(bw * scale)
    bearing = round(raw_width * 0.12)
    advance_width = raw_width + bearing * 2

    # Shift all paths right by the left bearing
    for path_group in paths:
        path_group["points"] = [(x + bearing, y) for x, y in path_group["points"]]

    return {
        "paths": paths,
        "advance_width": advance_width,
        "lsb": bearing,
    }
