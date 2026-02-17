---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, ux]
dependencies: []
---

# Fix Theme Flash for Saved Dark Mode Users

## Problem Statement
`ThemeToggle.tsx` initializes with hardcoded `"light"` theme. Users who previously selected dark mode will see a brief flash of light theme before the saved preference is applied.

## Findings
- **File**: `frontend/components/ThemeToggle.tsx`
- Initial state hardcoded to `"light"`
- Should read from `localStorage` or use a `<script>` tag in `<head>` to prevent flash

## Proposed Solutions

### Solution: Inline script in layout.tsx head
Add a blocking `<script>` that sets `data-theme` attribute before React hydrates.

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] No light-mode flash for dark-mode users on page load

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-17 | Created | Found during code review |
