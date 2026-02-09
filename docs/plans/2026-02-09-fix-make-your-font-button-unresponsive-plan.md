---
title: "Fix: Make Your Font button intermittently unresponsive"
type: fix
date: 2026-02-09
---

# Fix: "make your font" button intermittently unresponsive

## Overview

The "make your font" `motion.button` on the landing page sometimes does not respond to clicks. The button's `onClick={handleStart}` handler never fires. This occurs on Desktop Chrome, both on fresh page loads and after using "start over" to return to the landing screen.

## Problem Statement

The landing page uses Framer Motion's `<AnimatePresence mode="wait">` with a `<motion.button>` that has `whileHover` and `whileTap` gestures. There are several interacting factors that can cause the button to silently swallow clicks:

### Root Cause Analysis

**1. `AnimatePresence mode="wait"` blocks mounting of the next step**

`mode="wait"` means the exiting component must fully complete its exit animation before the entering component mounts. If the exit animation for the landing view (`exit={{ opacity: 0, y: -20 }}` with a spring transition) hasn't settled, clicking has no visible effect — `handleStart` fires and sets `step="input"`, but the `input` view can't mount until the `landing` view finishes unmounting. With spring physics (stiffness: 400, damping: 30), the exit animation can take 200-400ms to settle, during which there's a "dead zone" where nothing appears to happen.

However, the more critical issue is:

**2. `motion.button` with `whileTap` can swallow quick taps**

Framer Motion's `whileTap` gesture handler captures pointerdown/pointerup events. On fast clicks (especially on touchpads or when the user taps quickly), the gesture system can intercept the event before `onClick` fires. This is a known Framer Motion behavior where the tap gesture and onClick can race.

**3. Spring animation has no explicit `duration` — can overshoot**

The `spring` config `{ type: "spring", stiffness: 400, damping: 30 }` has no `restDelta` or `restSpeed` specified. Framer Motion defaults to `restDelta: 0.01` and `restSpeed: 0.01`, meaning the spring continues animating for tiny sub-pixel movements. Combined with `AnimatePresence mode="wait"`, this extends the window during which transitions block interaction.

**4. No click handler protection against double-fire during exit**

`handleStart` sets `step = "input"` unconditionally. If `AnimatePresence` is mid-exit when clicked, React may batch the state update but the animation system may not re-render the entering component until the exit completes. The user sees nothing happen.

## Proposed Solution

A focused, minimal fix addressing the click reliability without restructuring the animation system:

### Fix 1: Replace `motion.button` with plain `<button>` + CSS transition (Primary fix)

The `whileHover={{ scale: 1.02 }}` and `whileTap={{ scale: 0.98 }}` gestures add complexity for minimal visual benefit. Replace with a plain `<button>` using CSS `active:scale-[0.98]` and `hover:scale-[1.02]` via Tailwind. This eliminates the Framer Motion gesture layer that can intercept clicks.

**File:** `frontend/app/page.tsx:145-153`

```tsx
// Before
<motion.button
  onClick={handleStart}
  className="px-8 py-3.5 rounded-full bg-fg text-bg text-sm tracking-wide hover:bg-fg/85 transition-colors"
  style={{ boxShadow: "var(--shadow-md)" }}
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>
  make your font
</motion.button>

// After
<button
  onClick={handleStart}
  className="px-8 py-3.5 rounded-full bg-fg text-bg text-sm tracking-wide hover:bg-fg/85 transition-all hover:scale-[1.02] active:scale-[0.98]"
  style={{ boxShadow: "var(--shadow-md)" }}
>
  make your font
</button>
```

### Fix 2: Add `restDelta` to spring config to speed up animation settlement

**File:** `frontend/lib/motion.ts`

```ts
// Before
export const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

// After — settle faster so AnimatePresence transitions complete sooner
export const spring = { type: "spring" as const, stiffness: 400, damping: 30, restDelta: 0.5 };
```

This makes the spring animation consider itself "done" once movement is less than 0.5 units (instead of 0.01), dramatically reducing the time `AnimatePresence mode="wait"` blocks the next component from mounting.

### Fix 3 (Optional): Guard `handleStart` against redundant calls during exit

**File:** `frontend/app/page.tsx:41-44`

```ts
// Before
const handleStart = () => {
  setStep("input");
  setError(null);
};

// After — prevent no-op clicks during animation exit
const handleStart = () => {
  if (step !== "landing") return;
  setStep("input");
  setError(null);
};
```

## Acceptance Criteria

- [ ] "make your font" button responds to every click on Desktop Chrome
- [ ] Button still has hover/active visual feedback (scale effect)
- [ ] Animations between landing → input are smooth and not noticeably faster
- [ ] "start over" → re-clicking "make your font" works reliably
- [ ] No regressions to other animations or page transitions

## MVP

### frontend/app/page.tsx

Replace `motion.button` with plain `<button>`:

```tsx
<button
  onClick={handleStart}
  className="px-8 py-3.5 rounded-full bg-fg text-bg text-sm tracking-wide hover:bg-fg/85 transition-all hover:scale-[1.02] active:scale-[0.98]"
  style={{ boxShadow: "var(--shadow-md)" }}
>
  make your font
</button>
```

Guard handleStart:

```ts
const handleStart = () => {
  if (step !== "landing") return;
  setStep("input");
  setError(null);
};
```

### frontend/lib/motion.ts

Add `restDelta`:

```ts
export const spring = { type: "spring" as const, stiffness: 400, damping: 30, restDelta: 0.5 };
```

## References

- `frontend/app/page.tsx:122-163` — AnimatePresence + landing view with motion.button
- `frontend/lib/motion.ts:2` — spring config
- Framer Motion AnimatePresence `mode="wait"` docs: waits for exit to complete before mounting next child
- Framer Motion gesture system: whileTap can interfere with onClick on fast interactions
