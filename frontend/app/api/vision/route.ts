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
 * - In-memory per-IP rate limiting (best-effort; resets on cold start)
 * - CORS restricted to app's own origin
 *
 * Expects: { image: string }  (base64-encoded image, no data-url prefix)
 * Returns: Google Vision API annotateImage response (text annotations)
 */

/** Maximum base64 payload size: ~10 MB (covers images up to ~7.5 MB) */
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

// ── Rate Limiting (in-memory, best-effort on serverless) ─────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15; // requests per window per IP

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/** Evict expired entries periodically to prevent unbounded memory growth. */
function evictExpiredEntries() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

// Run eviction every 5 minutes
const evictionTimer = setInterval(evictExpiredEntries, 5 * 60 * 1000);
if (typeof evictionTimer.unref === "function") evictionTimer.unref();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ── CORS helpers ─────────────────────────────────────────────────────────────

function getAllowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;

  if (process.env.NODE_ENV === "development") {
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return origin;
    }
  }

  const appHost = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL;

  if (appHost && origin === appHost) return origin;

  const requestOrigin = new URL(req.url).origin;
  if (origin === requestOrigin) return origin;

  return null;
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(req);
  if (!allowedOrigin) return {};
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function withCors(req: NextRequest, response: NextResponse): NextResponse {
  const headers = corsHeaders(req);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

// ── OPTIONS handler for CORS preflight ───────────────────────────────────────
export async function OPTIONS(req: NextRequest) {
  const origin = getAllowedOrigin(req);
  if (!origin) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

// ── Existing helpers ─────────────────────────────────────────────────────────

/** Validate that a string looks like base64 (alphanumeric, +, /, =) */
function isValidBase64(str: string): boolean {
  if (str.length === 0) return false;
  if (str.startsWith("data:")) return false;
  return /^[A-Za-z0-9+/=]+$/.test(str.slice(0, 100));
}

export async function POST(req: NextRequest) {
  // ── CORS origin check ───────────────────────────────────────────────────
  const origin = req.headers.get("origin");
  if (origin && !getAllowedOrigin(req)) {
    return withCors(req, NextResponse.json({ error: "Origin not allowed." }, { status: 403 }));
  }

  // ── Rate limiting ──────────────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);

  if (!rateCheck.allowed) {
    const retryAfterSec = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
    return withCors(
      req,
      NextResponse.json(
        { error: "Too many requests. Please wait a moment before trying again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateCheck.resetAt / 1000)),
          },
        },
      ),
    );
  }

  // ── Check API key ────────────────────────────────────────────────────────
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_VISION_API_KEY is not set in environment variables");
    return withCors(
      req,
      NextResponse.json(
        { error: "Vision API is not configured. Set GOOGLE_VISION_API_KEY in your environment." },
        { status: 503 },
      ),
    );
  }

  // ── Validate Content-Type ────────────────────────────────────────────────
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return withCors(req, NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 }));
  }

  // ── Parse & validate body ────────────────────────────────────────────────
  let image: string;
  try {
    const body = await req.json();
    image = (body as { image?: string }).image ?? "";
  } catch {
    return withCors(req, NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
  }

  if (!image) {
    return withCors(req, NextResponse.json({ error: "Missing 'image' field (base64-encoded image)" }, { status: 400 }));
  }

  // Size check (base64 string length ≈ 1.33× raw bytes)
  if (image.length > MAX_PAYLOAD_BYTES) {
    return withCors(
      req,
      NextResponse.json(
        { error: `Image too large. Maximum size is ~${Math.round(MAX_PAYLOAD_BYTES / 1024 / 1024)} MB.` },
        { status: 413 },
      ),
    );
  }

  // Basic base64 validation
  if (!isValidBase64(image)) {
    return withCors(
      req,
      NextResponse.json(
        { error: "Invalid image data. Send raw base64 without the data:image/... prefix." },
        { status: 400 },
      ),
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
            features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
            imageContext: { languageHints: ["en"] },
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errorBody = await visionResponse.text();
      console.error("Vision API error:", visionResponse.status, errorBody);

      if (visionResponse.status === 403) {
        return withCors(
          req,
          NextResponse.json({ error: "Vision API access denied. Check your API key permissions." }, { status: 502 }),
        );
      }
      if (visionResponse.status === 429) {
        return withCors(
          req,
          NextResponse.json({ error: "Vision API rate limit exceeded. Please try again in a moment." }, { status: 429 }),
        );
      }

      return withCors(req, NextResponse.json({ error: `Vision API returned ${visionResponse.status}` }, { status: 502 }));
    }

    const data: unknown = await visionResponse.json();
    if (data && typeof data === "object" && "error" in data) {
      return withCors(req, NextResponse.json({ error: "Vision API returned an error" }, { status: 502 }));
    }
    return withCors(req, NextResponse.json(data));
  } catch (err) {
    console.error("Vision proxy error:", err);
    return withCors(
      req,
      NextResponse.json({ error: "Failed to reach Vision API. Please try again." }, { status: 502 }),
    );
  }
}
