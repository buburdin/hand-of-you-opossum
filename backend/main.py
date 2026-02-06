"""FastAPI backend for handwriting-to-font conversion."""

import base64
import random
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pangrams import PANGRAMS
from pipeline.preprocess import load_image_from_bytes, preprocess, preprocess_single_glyph
from pipeline.segment import segment_characters, extract_single_glyph
from pipeline.vectorize import process_glyph_bitmap
from pipeline.fontgen import create_font, create_font_from_chars

app = FastAPI(title="Hand of You - Font Generator")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/pangram")
async def get_pangram():
    """Return a random pangram."""
    return {"pangram": random.choice(PANGRAMS)}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/process-pangram")
async def process_pangram(
    image: UploadFile = File(...),
    pangram: str = Form(...),
):
    """
    Process a handwriting photo of a pangram into a font.
    
    1. Preprocess the image
    2. Segment individual characters
    3. Map to pangram characters
    4. Vectorize each glyph
    5. Generate TTF + WOFF2 font files
    """
    try:
        image_data = await image.read()
        img = load_image_from_bytes(image_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    try:
        binary = preprocess(img)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image preprocessing failed: {str(e)}")

    try:
        char_pairs = segment_characters(binary, pangram)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Character segmentation failed: {str(e)}. Try a clearer photo with more contrast.",
        )

    if not char_pairs:
        raise HTTPException(
            status_code=422,
            detail="No characters could be segmented from the image. Try writing larger and with more spacing.",
        )

    # Build char -> bitmap mapping
    char_bitmaps = {char: bitmap for char, bitmap in char_pairs}

    try:
        ttf_bytes, woff2_bytes = create_font_from_chars(char_bitmaps)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Font generation failed: {str(e)}")

    return JSONResponse(
        content={
            "ttf": base64.b64encode(ttf_bytes).decode("ascii"),
            "woff2": base64.b64encode(woff2_bytes).decode("ascii"),
            "chars_found": list(char_bitmaps.keys()),
            "total_chars": len(char_bitmaps),
        }
    )


@app.post("/api/process-glyph")
async def process_glyph_endpoint(
    image: UploadFile = File(...),
    character: str = Form(...),
):
    """Process a single drawn character and return vectorized glyph data."""
    if len(character) != 1 or not character.isalpha():
        raise HTTPException(status_code=400, detail="Character must be a single letter")

    try:
        image_data = await image.read()
        binary = preprocess_single_glyph(image_data)
        binary = extract_single_glyph(binary)
        glyph_data = process_glyph_bitmap(binary)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Glyph processing failed: {str(e)}")

    return JSONResponse(content={
        "character": character.lower(),
        "glyph": glyph_data,
    })


@app.post("/api/process-drawn-glyphs")
async def process_drawn_glyphs(request: Request):
    """
    Process multiple drawn characters at once and generate a font.
    Files should be named char_a, char_b, ... char_z as form fields.
    """
    form = await request.form()

    char_bitmaps = {}
    for key in form:
        value = form[key]
        if key.startswith("char_") and len(key) == 6:
            char = key[5:].lower()
            if char.isalpha() and len(char) == 1:
                image_data = await value.read()
                binary = preprocess_single_glyph(image_data)
                binary = extract_single_glyph(binary)
                char_bitmaps[char] = binary

    if not char_bitmaps:
        raise HTTPException(status_code=400, detail="No valid character images provided")

    try:
        ttf_bytes, woff2_bytes = create_font_from_chars(char_bitmaps)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Font generation failed: {str(e)}")

    return JSONResponse(
        content={
            "ttf": base64.b64encode(ttf_bytes).decode("ascii"),
            "woff2": base64.b64encode(woff2_bytes).decode("ascii"),
            "chars_found": list(char_bitmaps.keys()),
            "total_chars": len(char_bitmaps),
        }
    )


@app.post("/api/generate-font")
async def generate_font_endpoint(request: Request):
    """Generate font from pre-processed glyph data."""
    data = await request.json()
    glyphs = data.get("glyphs", {})

    if not glyphs:
        raise HTTPException(status_code=400, detail="No glyph data provided")

    try:
        ttf_bytes, woff2_bytes = create_font(glyphs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Font generation failed: {str(e)}")

    return JSONResponse(
        content={
            "ttf": base64.b64encode(ttf_bytes).decode("ascii"),
            "woff2": base64.b64encode(woff2_bytes).decode("ascii"),
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
