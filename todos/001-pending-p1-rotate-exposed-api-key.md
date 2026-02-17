---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, vercel]
dependencies: []
---

# Rotate Exposed Google Vision API Key

## Problem Statement
The Google Cloud Vision API key (`AIzaSyDWg_0ncofugPolXEjB4klsl5gVebY_elc`) was exposed during this code review session. While the key is correctly stored in `.env.local` (not tracked by git) and only accessed server-side, **it was read and displayed in the conversation context**. The key should be considered compromised and rotated immediately.

## Findings
- **File**: `frontend/.env.local` — contains `GOOGLE_VISION_API_KEY=AIzaSyDWg_0ncofugPolXEjB4klsl5gVebY_elc`
- The key is NOT tracked by git (confirmed via `git ls-files`)
- No `NEXT_PUBLIC_` prefix — correctly server-side only
- Only used in `frontend/app/api/vision/route.ts` line 33
- **Positive**: The architecture is sound — API key stays server-side, client calls `/api/vision`

## Proposed Solutions

### Solution A: Rotate Key in Google Cloud Console (Recommended)
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Delete the current key
3. Create a new key with restrictions (HTTP referrer, API scope)
4. Update `.env.local` locally
5. Update Vercel environment variables

- **Pros**: Simple, immediate
- **Cons**: Brief downtime while updating
- **Effort**: Small (15 min)
- **Risk**: Low

### Solution B: Rotate + Add API Key Restrictions
1. Same as Solution A
2. Additionally restrict the key to:
   - Only Vision API
   - Only from your Vercel deployment URLs
   - Set a daily quota limit

- **Pros**: Defense in depth
- **Cons**: Slightly more setup
- **Effort**: Small (30 min)
- **Risk**: Low

## Recommended Action
Solution B — rotate and restrict.

## Technical Details
- **Affected files**: `frontend/.env.local`, Vercel environment settings
- **Components**: `/api/vision` route
- **Vercel**: Set `GOOGLE_VISION_API_KEY` in Project Settings → Environment Variables

## Acceptance Criteria
- [ ] Old API key is deleted in Google Cloud Console
- [ ] New API key is created with restrictions (Vision API only)
- [ ] `.env.local` updated locally with new key
- [ ] Vercel environment variable updated
- [ ] App tested end-to-end with new key

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |

## Resources
- Google Cloud Console: https://console.cloud.google.com/apis/credentials
- Vercel Env Vars: https://vercel.com/docs/environment-variables
