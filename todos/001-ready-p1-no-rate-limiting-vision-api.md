---
status: resolved
priority: p1
issue_id: "001"
tags: [code-review, security, deployment]
dependencies: []
---

# No Rate Limiting on /api/vision Endpoint

## Problem Statement

The Vision API proxy endpoint (`POST /api/vision`) has no rate limiting, authentication, or CORS restrictions. Anyone who discovers this endpoint can use it as a free proxy to Google Cloud Vision API, burning through API quota and incurring costs. This is especially critical since the app is deploying to Vercel with no built-in per-IP rate limiting for serverless functions.

## Findings

- **Source agents:** security-sentinel, architecture-strategist
- **File:** `frontend/app/api/vision/route.ts`
- Input validation exists (content-type, base64 format, 10MB size limit) but does not prevent abuse
- No authentication mechanism -- the endpoint is fully public
- The `isValidBase64` function only checks the first 100 characters (line 23-29)
- No CORS restrictions -- cross-origin requests are accepted

## Proposed Solutions

### Option A: Upstash Rate Limiting (Recommended)
Use `@upstash/ratelimit` with Vercel KV/Redis for distributed rate limiting.
- **Pros:** Works across Vercel serverless instances, battle-tested, 10-15 min setup
- **Cons:** Adds a dependency and requires Upstash account
- **Effort:** Small
- **Risk:** Low

### Option B: In-Memory Rate Limiter
Simple Map-based per-IP counter in the API route.
- **Pros:** Zero dependencies, immediate
- **Cons:** Does not persist across serverless cold starts, ineffective at scale
- **Effort:** Small
- **Risk:** Medium (limited effectiveness on serverless)

### Option C: Vercel Edge Config + Middleware
Use Next.js middleware with Vercel Edge Config for rate limiting.
- **Pros:** Runs before the function, lower latency
- **Cons:** More complex setup, Vercel-specific
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Use Option B (in-memory rate limiter) for launch -- zero dependencies, good enough for initial deployment. Upgrade to Upstash if abuse is detected.

## Technical Details

- **Affected files:** `frontend/app/api/vision/route.ts`
- **Also consider:** Adding CORS restrictions and a CSRF token

## Acceptance Criteria

- [ ] Rate limiting is enforced (e.g., 10-20 requests per minute per IP)
- [ ] Exceeding the limit returns HTTP 429 with a user-friendly message
- [ ] CORS is restricted to the app's own origin
- [ ] Works correctly on Vercel serverless deployment

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | Identified by security-sentinel and architecture-strategist agents |
| 2026-02-17 | Approved during triage | Status: pending -> ready. Use in-memory rate limiter for launch. |

## Resources

- [Upstash Rate Limiting](https://upstash.com/docs/oss/sdks/ts/ratelimit/overview)
- [Vercel Edge Middleware](https://vercel.com/docs/functions/edge-middleware)
