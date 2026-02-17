---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, security, vercel]
dependencies: []
---

# Add Security Headers for Vercel Deployment

## Problem Statement
No security headers are configured. For a Vercel deployment, this means the app is missing standard protections against clickjacking, MIME sniffing, and XSS.

## Findings
- No `vercel.json` with headers configuration
- No `next.config.ts` headers configuration
- Missing headers: `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`

## Proposed Solutions

### Solution A: Add headers in next.config.ts (Recommended)
```typescript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
    ],
  }];
}
```

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria
- [ ] Security headers present in responses
- [ ] Verified with browser DevTools or security scanner

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
