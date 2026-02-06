"""Font generation using fontTools - creates TTF and WOFF2 from glyph data."""

import io
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
import brotli

UNITS_PER_EM = 1000
ASCENDER = 800
DESCENDER = -200


def create_font(
    glyphs: dict[str, dict],
    family_name: str = "MyHandwriting",
    style_name: str = "Regular",
) -> tuple[bytes, bytes]:
    """
    Create TTF and WOFF2 font files from glyph path data.
    
    Args:
        glyphs: dict mapping character -> glyph data dict with:
            - paths: list of {points: [(x,y)...], is_hole: bool}
            - advance_width: int
            - lsb: int
        family_name: font family name
        style_name: font style (e.g., "Regular")
        
    Returns:
        Tuple of (ttf_bytes, woff2_bytes)
    """
    # Build glyph order - include both lowercase glyph names
    glyph_names = [".notdef", "space"]
    for c in sorted(glyphs.keys()):
        glyph_names.append(f"uni{ord(c):04X}")

    fb = FontBuilder(UNITS_PER_EM, isTTF=True)
    fb.setupGlyphOrder(glyph_names)

    # Character to glyph name mapping
    # Map both lowercase and uppercase to the same glyph
    cmap = {ord(" "): "space"}
    for char in glyphs:
        glyph_name = f"uni{ord(char):04X}"
        cmap[ord(char)] = glyph_name
        # Map uppercase to same glyph so typing capitals works
        if char.islower():
            cmap[ord(char.upper())] = glyph_name

    fb.setupCharacterMap(cmap)

    # Build glyph outlines
    glyph_table = {}

    # .notdef glyph (empty rectangle)
    notdef_pen = TTGlyphPen(None)
    notdef_pen.moveTo((100, 0))
    notdef_pen.lineTo((100, 700))
    notdef_pen.lineTo((500, 700))
    notdef_pen.lineTo((500, 0))
    notdef_pen.closePath()
    # Inner cutout
    notdef_pen.moveTo((150, 50))
    notdef_pen.lineTo((450, 50))
    notdef_pen.lineTo((450, 650))
    notdef_pen.lineTo((150, 650))
    notdef_pen.closePath()
    glyph_table[".notdef"] = notdef_pen.glyph()

    # Space glyph (empty)
    space_pen = TTGlyphPen(None)
    glyph_table["space"] = space_pen.glyph()

    # User glyphs
    for char in sorted(glyphs.keys()):
        glyph_data = glyphs[char]
        glyph_name = f"uni{ord(char):04X}"
        pen = TTGlyphPen(None)

        for path_group in glyph_data["paths"]:
            points = path_group["points"]
            if len(points) < 3:
                continue

            # Ensure points are tuples
            pts = [tuple(p) if isinstance(p, list) else p for p in points]
            pen.moveTo(pts[0])
            for pt in pts[1:]:
                pen.lineTo(pt)
            pen.closePath()

        try:
            glyph_table[glyph_name] = pen.glyph()
        except Exception:
            # Fallback: empty glyph
            empty_pen = TTGlyphPen(None)
            glyph_table[glyph_name] = empty_pen.glyph()

    fb.setupGlyf(glyph_table)

    # Metrics
    metrics = {
        ".notdef": (600, 100),
        "space": (UNITS_PER_EM // 4, 0),
    }
    for char in sorted(glyphs.keys()):
        glyph_name = f"uni{ord(char):04X}"
        glyph_data = glyphs[char]
        metrics[glyph_name] = (glyph_data["advance_width"], glyph_data["lsb"])

    fb.setupHorizontalMetrics(metrics)

    fb.setupHorizontalHeader(ascent=ASCENDER, descent=DESCENDER)
    fb.setupNameTable({
        "familyName": family_name,
        "styleName": style_name,
    })
    fb.setupOS2(
        sTypoAscender=ASCENDER,
        sTypoDescender=DESCENDER,
        sTypoLineGap=0,
        usWinAscent=ASCENDER,
        usWinDescent=abs(DESCENDER),
        sxHeight=500,
        sCapHeight=700,
    )
    fb.setupPost()

    font = fb.font

    # Generate TTF bytes
    ttf_buffer = io.BytesIO()
    font.save(ttf_buffer)
    ttf_bytes = ttf_buffer.getvalue()

    # Generate WOFF2 bytes
    woff2_buffer = io.BytesIO()
    font.flavor = "woff2"
    font.save(woff2_buffer)
    woff2_bytes = woff2_buffer.getvalue()

    return ttf_bytes, woff2_bytes


def create_font_from_chars(
    char_bitmaps: dict[str, "np.ndarray"],
) -> tuple[bytes, bytes]:
    """
    High-level convenience: go from character bitmaps straight to font files.
    
    Args:
        char_bitmaps: dict mapping character -> binary numpy array
        
    Returns:
        Tuple of (ttf_bytes, woff2_bytes)
    """
    from .vectorize import process_glyph_bitmap

    glyphs = {}
    for char, bitmap in char_bitmaps.items():
        glyph_data = process_glyph_bitmap(bitmap)
        if glyph_data["paths"]:  # Only include if we got valid paths
            glyphs[char] = glyph_data

    if not glyphs:
        raise ValueError("No valid glyphs could be extracted from the provided images")

    return create_font(glyphs)
