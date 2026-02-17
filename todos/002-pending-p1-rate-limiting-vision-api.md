---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, vercel, api]
dependencies: []
---

# Add Rate Limiting to /api/vision Endpoint

## Problem Statement
The `/api/vision` API route has no rate limiting, authentication, or abuse protection. Anyone who discovers the endpoint can make unlimited calls, consuming your Google Vision API quota and potentially running up billing costs. This is critical for a Vercel deployment where the endpoint is publicly accessible.

## Findings
- **File**: `frontend/app/api/vision/route.ts`
- No rate limiting middleware
- No authentication or session validation
- No CORS restrictions (any origin can call it)
- 10MB payload size limit exists but is generous
- Each call forwards to Google Vision API (billed per request)

## Proposed Solutions

### Solution A: Vercel KV Rate Limiting (Recommended for Vercel)
Use `@vercel/kv` with a sliding window rate limiter:
- 10 requests per minute per IP
- Return 429 Too Many Requests when exceeded

- **Pros**: Native to Vercel, persistent across instances, simple
- **Cons**: Requires Vercel KV add-on (free tier available)
- **Effort**: Small
- **Risk**: Low

### Solution B: In-Memory Rate Limiting with upstash/ratelimit
Use `@upstash/ratelimit` with Upstash Redis:
- Works well on Vercel serverless
- Sliding window algorithm
- Free tier sufficient for this app

- **Pros**: Purpose-built, battle-tested
- **Cons**: External dependency
- **Effort**: Small
- **Risk**: Low

### Solution C: Simple IP-Based Header Check
Use `x-forwarded-for` header with an in-memory Map and TTL:
- Stateless, no external deps
- Won't survive across serverless invocations but provides basic protection

- **Pros**: Zero dependencies, quick
- **Cons**: Resets on cold start, not reliable on serverless
- **Effort**: Small
- **Risk**: Medium (may not persist)

## Technical Details
- **Affected files**: `frontend/app/api/vision/route.ts`
- **Components**: API route handler

## Acceptance Criteria
- [ ] Rate limiting applied to `/api/vision`
- [ ] Returns 429 with clear message when limit exceeded
- [ ] Tested with rapid repeated requests
- [ ] Legitimate usage (1-2 requests per font generation) is not affected

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
