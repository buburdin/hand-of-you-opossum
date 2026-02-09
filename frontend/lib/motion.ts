/** Default spring transition used across the app. */
export const spring = { type: "spring" as const, stiffness: 400, damping: 30, restDelta: 0.5 };

/** Snappier spring for mode selector and letter transitions. */
export const springSnappy = { type: "spring" as const, stiffness: 500, damping: 35 };
