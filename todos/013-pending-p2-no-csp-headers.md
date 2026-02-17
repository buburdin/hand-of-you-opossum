---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, security, deployment]
dependencies: []
---

# No Content Security Policy Headers

## Problem Statement

The application has no Content Security Policy (CSP) headers configured. CSP helps prevent XSS attacks by restricting which scripts, styles, and resources can be loaded. This is important for a production deployment on Vercel.

## Findings

- **Source agents:** security-sentinel
- No CSP headers in Next.js config or middleware
- No security headers configured at all (no X-Frame-Options, X-Content-Type-Options, etc.)

## Proposed Solutions

### Option A: Next.js Security Headers (Recommended)
Add security headers via `next.config.ts`:
```typescript
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' blob: data:; connect-src 'self' https://vision.googleapis.com" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ],
  }];
}
```
- **Effort:** Small (30 minutes)
- **Risk:** Low (may need tweaking for WASM and inline styles)

## Acceptance Criteria

- [ ] CSP headers are set and do not break app functionality
- [ ] X-Frame-Options, X-Content-Type-Options headers are present
- [ ] WASM loading still works under CSP

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
