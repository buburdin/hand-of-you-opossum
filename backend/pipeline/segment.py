"""Character segmentation from preprocessed handwriting images."""

import cv2
import numpy as np


def segment_characters(binary: np.ndarray, pangram: str) -> list[tuple[str, np.ndarray]]:
    """
    Segment individual characters from a preprocessed binary image.
    
    Strategy:
    1. Find all connected components (contours)
    2. Merge components that likely belong to the same character (i, j dots)
    3. Sort left-to-right, top-to-bottom (to match pangram order)
    4. Map each blob to the corresponding character in the pangram
    
    Args:
        binary: Binary image (white chars on black background)
        pangram: The known pangram text the user wrote
        
    Returns:
        List of (character, cropped_binary_image) tuples
    """
    # Find contours
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        raise ValueError("No characters found in image")

    # Get bounding boxes
    bboxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w > 5 and h > 5:  # Filter tiny noise
            bboxes.append((x, y, w, h, contour))

    if not bboxes:
        raise ValueError("No valid character regions found")

    # Merge overlapping / close bounding boxes (handles i, j dots, etc.)
    merged = merge_close_bboxes(bboxes, binary)

    # Sort by reading order: top-to-bottom by line, then left-to-right
    sorted_bboxes = sort_reading_order(merged, binary.shape[0])

    # Extract only alphabetic characters from the pangram (in order)
    pangram_chars = []
    for c in pangram.lower():
        if c.isalpha():
            pangram_chars.append(c)

    # Map segmented blobs to pangram characters
    # We take the first N blobs matching the number of pangram letters
    results: list[tuple[str, np.ndarray]] = []
    seen_chars: dict[str, np.ndarray] = {}

    for i, (x, y, w, h) in enumerate(sorted_bboxes):
        if i >= len(pangram_chars):
            break

        char = pangram_chars[i]

        # Crop the character with some padding
        pad = 4
        y1 = max(0, y - pad)
        y2 = min(binary.shape[0], y + h + pad)
        x1 = max(0, x - pad)
        x2 = min(binary.shape[1], x + w + pad)
        cropped = binary[y1:y2, x1:x2].copy()

        # Only keep first occurrence of each character
        if char not in seen_chars:
            seen_chars[char] = cropped
            results.append((char, cropped))

    return results


def merge_close_bboxes(
    bboxes: list[tuple[int, int, int, int, np.ndarray]],
    binary: np.ndarray,
) -> list[tuple[int, int, int, int]]:
    """
    Merge bounding boxes that are vertically close (handles dots on i, j, etc.).
    Uses a simple heuristic: if a small component is directly above a larger one
    and within a certain vertical distance, merge them.
    """
    # Sort by area (largest first) for merging decisions
    boxes = [(x, y, w, h) for x, y, w, h, _ in bboxes]
    
    # Calculate median height for relative thresholds
    heights = [h for _, _, _, h in boxes]
    if not heights:
        return boxes
    median_h = sorted(heights)[len(heights) // 2]

    merged: list[tuple[int, int, int, int]] = []
    used = set()

    # Sort by y position
    indexed = list(enumerate(boxes))
    indexed.sort(key=lambda t: t[1][1])  # sort by y

    for i, (x1, y1, w1, h1) in indexed:
        if i in used:
            continue

        # Check if this is a small component (potential dot)
        is_small = h1 < median_h * 0.4 and w1 < median_h * 0.4

        if is_small:
            # Try to find a parent character below it
            best_parent = None
            best_dist = float("inf")
            for j, (x2, y2, w2, h2) in indexed:
                if j == i or j in used:
                    continue
                # Parent should be below and horizontally overlapping
                if y2 > y1 and abs((x1 + w1 / 2) - (x2 + w2 / 2)) < w2:
                    dist = y2 - (y1 + h1)
                    if dist < median_h * 0.8 and dist < best_dist:
                        best_dist = dist
                        best_parent = j

            if best_parent is not None:
                px, py, pw, ph = boxes[best_parent]
                # Merge: create bounding box encompassing both
                mx = min(x1, px)
                my = min(y1, py)
                mx2 = max(x1 + w1, px + pw)
                my2 = max(y1 + h1, py + ph)
                merged.append((mx, my, mx2 - mx, my2 - my))
                used.add(i)
                used.add(best_parent)
                continue

        if i not in used:
            merged.append((x1, y1, w1, h1))
            used.add(i)

    return merged


def sort_reading_order(
    bboxes: list[tuple[int, int, int, int]], img_height: int
) -> list[tuple[int, int, int, int]]:
    """
    Sort bounding boxes in reading order (top-to-bottom by line, left-to-right within line).
    Groups characters into lines based on vertical overlap.
    """
    if not bboxes:
        return bboxes

    # Calculate median height for line grouping
    heights = [h for _, _, _, h in bboxes]
    median_h = sorted(heights)[len(heights) // 2]
    line_threshold = median_h * 0.5

    # Sort by y first
    sorted_by_y = sorted(bboxes, key=lambda b: b[1])

    # Group into lines
    lines: list[list[tuple[int, int, int, int]]] = []
    current_line: list[tuple[int, int, int, int]] = [sorted_by_y[0]]
    current_y = sorted_by_y[0][1]

    for bbox in sorted_by_y[1:]:
        if abs(bbox[1] - current_y) < line_threshold:
            current_line.append(bbox)
        else:
            lines.append(current_line)
            current_line = [bbox]
            current_y = bbox[1]
    lines.append(current_line)

    # Sort each line left-to-right, then flatten
    result = []
    for line in lines:
        line.sort(key=lambda b: b[0])
        result.extend(line)

    return result


def extract_single_glyph(binary: np.ndarray) -> np.ndarray:
    """
    Extract and center a single glyph from a binary image (for draw mode).
    Crops to content and centers in a square canvas.
    """
    # Find content bounds
    coords = cv2.findNonZero(binary)
    if coords is None:
        return binary

    x, y, w, h = cv2.boundingRect(coords)
    cropped = binary[y : y + h, x : x + w]

    # Center in a square canvas with padding
    size = max(w, h) + 20
    canvas = np.zeros((size, size), dtype=np.uint8)
    ox = (size - w) // 2
    oy = (size - h) // 2
    canvas[oy : oy + h, ox : ox + w] = cropped

    return canvas
