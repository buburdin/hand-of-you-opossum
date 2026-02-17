---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, security]
dependencies: []
---

# Sanitize Error Messages in API Route

## Problem Statement
Error messages in `/api/vision/route.ts` reveal environment variable names (e.g., "GOOGLE_VISION_API_KEY is not configured"), giving attackers information about the server's internal configuration.

## Findings
- **File**: `frontend/app/api/vision/route.ts`
- Line with error: reveals `GOOGLE_VISION_API_KEY` env var name
- Should return generic "Service unavailable" to clients
- Log detailed error server-side only

## Proposed Solutions

### Solution: Generic client errors, detailed server logs
Return `"Vision service temporarily unavailable"` to client, log specific env var name server-side with `console.error`.

- **Effort**: Small (5 min)
- **Risk**: None

## Acceptance Criteria
- [ ] No env var names in client-facing error responses
- [ ] Server-side logs still contain detailed error info

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
