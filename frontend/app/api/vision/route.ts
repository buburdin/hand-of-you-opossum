import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/vision
 *
 * Proxies image data to Google Cloud Vision API (DOCUMENT_TEXT_DETECTION).
 * Keeps the API key server-side only — never exposed to the browser.
 *
 * Security measures:
 * - API key is only read from server-side env (never NEXT_PUBLIC_)
 * - Request body size is validated (max ~10 MB base64 ≈ ~7.5 MB image)
 * - Content-Type is validated
 * - Only the required Vision API feature is requested
 *
 * Expects: { image: string }  (base64-encoded image, no data-url prefix)
 * Returns: Google Vision API annotateImage response (text annotations)
 */

/** Maximum base64 payload size: ~10 MB (covers images up to ~7.5 MB) */
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

/** Validate that a string looks like base64 (alphanumeric, +, /, =) */
function isValidBase64(str: string): boolean {
  if (str.length === 0) return false;
  // Quick sanity check — don't regex the whole string, just check it doesn't
  // contain obvious non-base64 chars (e.g. data:image/... prefix)
  if (str.startsWith("data:")) return false;
  return /^[A-Za-z0-9+/=]+$/.test(str.slice(0, 100));
}

export async function POST(req: NextRequest) {
  // ── Check API key ────────────────────────────────────────────────────────
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_VISION_API_KEY is not set in environment variables");
    return NextResponse.json(
      { error: "Vision API is not configured. Set GOOGLE_VISION_API_KEY in your environment." },
      { status: 503 },
    );
  }

  // ── Validate Content-Type ────────────────────────────────────────────────
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  // ── Parse & validate body ────────────────────────────────────────────────
  let image: string;
  try {
    const body = await req.json();
    image = (body as { image?: string }).image ?? "";
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!image) {
    return NextResponse.json(
      { error: "Missing 'image' field (base64-encoded image)" },
      { status: 400 },
    );
  }

  // Size check (base64 string length ≈ 1.33× raw bytes)
  if (image.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: `Image too large. Maximum size is ~${Math.round(MAX_PAYLOAD_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  // Basic base64 validation
  if (!isValidBase64(image)) {
    return NextResponse.json(
      { error: "Invalid image data. Send raw base64 without the data:image/... prefix." },
      { status: 400 },
    );
  }

  // ── Call Google Vision API ───────────────────────────────────────────────
  try {
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const visionResponse = await fetch(visionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image },
            features: [
              {
                type: "DOCUMENT_TEXT_DETECTION",
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: ["en"],
            },
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errorBody = await visionResponse.text();
      console.error("Vision API error:", visionResponse.status, errorBody);

      // Map common Google API errors to user-friendly messages
      if (visionResponse.status === 403) {
        return NextResponse.json(
          { error: "Vision API access denied. Check your API key permissions." },
          { status: 502 },
        );
      }
      if (visionResponse.status === 429) {
        return NextResponse.json(
          { error: "Vision API rate limit exceeded. Please try again in a moment." },
          { status: 429 },
        );
      }

      return NextResponse.json(
        { error: `Vision API returned ${visionResponse.status}` },
        { status: 502 },
      );
    }

    const data = await visionResponse.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Vision proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach Vision API. Please try again." },
      { status: 502 },
    );
  }
}
