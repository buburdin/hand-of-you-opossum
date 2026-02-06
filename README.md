# Hand of You

Turn your handwriting into a font. Snap a photo of a pangram or draw letters on screen — get a real font file you can use anywhere.

## Stack

- **Frontend**: Next.js 15, Tailwind CSS v4, Framer Motion
- **Backend**: Python FastAPI, OpenCV, fontTools
- **Font format**: TTF (download) + WOFF2 (web rendering)

## Getting Started

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Make sure `NEXT_PUBLIC_API_URL` is set to `http://localhost:8000` (default).

## How It Works

1. **Write** a pangram on paper or draw letters on screen
2. **Snap** a photo or upload an image
3. **Process**: OpenCV segments characters, contours are vectorized, fontTools assembles the font
4. **Type** with your new font, download .ttf, or save text as an image

## Project Structure

```
├── frontend/          Next.js app
│   ├── app/           Pages and layout
│   ├── components/    React components
│   └── lib/           Utilities (API, font loader, pangrams)
├── backend/           Python FastAPI
│   ├── main.py        API endpoints
│   └── pipeline/      Image processing + font generation
└── README.md
```
