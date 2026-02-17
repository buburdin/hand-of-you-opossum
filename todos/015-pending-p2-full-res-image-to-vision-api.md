---
status: resolved
priority: p2
issue_id: "015"
tags: [code-review, performance, quality]
dependencies: []
---

# Full-Resolution Image Sent to Vision API

## Problem Statement

In `processPangramLocally`, the original full-resolution `imageBlob` (3-5MB for phone photos) is sent to the Vision API, while the preprocessing pipeline already downscales to 1200px. Sending the downscaled version (~200-400KB) would reduce base64 encoding time, network upload time, and API proxy memory usage.

## Findings

- **Source agents:** performance-oracle, architecture-strategist
- **File:** `frontend/lib/pipeline/index.ts` (line 302: `await callVisionAPI(imageBlob)`)
- The preprocessed image is already downscaled to MAX_PREPROCESS_DIM = 1200
- Google Vision API works well at lower resolutions for text detection

## Proposed Solutions

### Fix: Send Downscaled Image (Recommended)
After downscaling in `loadImageData`, export the downscaled image as a JPEG blob and send that to the Vision API.
- **Effort:** Medium (1 hour)
- **Risk:** Low (Vision API handles lower res well for text detection)

## Acceptance Criteria

- [ ] Vision API receives the downscaled image, not the original
- [ ] Text detection quality is maintained
- [ ] Upload time is noticeably faster on mobile

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created during code review | |
