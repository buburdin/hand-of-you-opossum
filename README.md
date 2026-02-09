# Hand of You

Turn your handwriting into a font. Snap a photo of a pangram or draw letters on screen — get a real font file you can use anywhere.

## Stack

- **Frontend**: Next.js 16, Tailwind CSS v4, Framer Motion
- **Processing**: Entirely client-side — Canvas API, esm-potrace-wasm, opentype.js
- **Font format**: TTF (download)

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. **Write** a pangram on paper or draw letters on screen
2. **Snap** a photo or upload an image
3. **Process**: Characters are segmented, vectorized with potrace, and assembled into a font — all in the browser
4. **Type** with your new font, download .ttf, or save text as an image

## Project Structure

```
frontend/
  app/           Pages and layout
  components/    React components
  lib/           Utilities (font loader, pangrams, motion constants)
  lib/pipeline/  Image processing + font generation pipeline
```
