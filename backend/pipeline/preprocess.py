"""Image preprocessing for handwriting extraction using OpenCV."""

import cv2
import numpy as np
from PIL import Image
import io


def load_image_from_bytes(data: bytes) -> np.ndarray:
    """Load an image from raw bytes into an OpenCV BGR array."""
    nparr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image data")
    return img


def preprocess(img: np.ndarray) -> np.ndarray:
    """
    Preprocess a handwriting image for character segmentation.
    
    Steps:
    1. Convert to grayscale
    2. Apply Gaussian blur to reduce noise
    3. Adaptive Gaussian threshold for binarization
    4. Morphological operations to clean up
    5. Invert so characters are white-on-black (needed for contour detection)
    
    Returns a binary image (0 or 255) with characters as white on black background.
    """
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive threshold: handles uneven lighting from phone photos
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 10
    )

    # Morphological close to fill small gaps in strokes
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)

    # Remove small noise blobs
    cleaned = remove_small_components(cleaned, min_area=50)

    return cleaned


def remove_small_components(binary: np.ndarray, min_area: int = 50) -> np.ndarray:
    """Remove connected components smaller than min_area pixels."""
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    result = np.zeros_like(binary)
    for i in range(1, num_labels):  # skip background (label 0)
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            result[labels == i] = 255
    return result


def preprocess_single_glyph(data: bytes) -> np.ndarray:
    """
    Preprocess a single character drawing (from canvas mode).
    Simpler pipeline since canvas drawings are already clean.
    """
    img = load_image_from_bytes(data)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Simple Otsu threshold works well for clean canvas drawings
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Light cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)

    return cleaned
