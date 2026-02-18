"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Theme = "light" | "night";

const STORAGE_KEY = "hoy-theme";
const OVERRIDE_KEY = "hoy-theme-manual";
const THEME_COLORS: Record<Theme, string> = {
  light: "#fafaf8",
  night: "#0f1113",
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "night" ? "dark" : "light";

  const meta = document.querySelector("meta[name=theme-color]");
  if (meta) {
    meta.setAttribute("content", THEME_COLORS[theme]);
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "night"
    : "light";
}

function getInitialTheme(): Theme {
  if (window.localStorage.getItem(OVERRIDE_KEY)) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "night") return stored;
  }
  return systemTheme();
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const hasManualOverride = useRef(false);

  useEffect(() => {
    setMounted(true);
    hasManualOverride.current = !!window.localStorage.getItem(OVERRIDE_KEY);
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (hasManualOverride.current) return;
      const next: Theme = e.matches ? "night" : "light";
      setTheme(next);
      applyTheme(next);
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "night" ? "light" : "night";
      const matchesSystem = next === systemTheme();
      if (matchesSystem) {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(OVERRIDE_KEY);
        hasManualOverride.current = false;
      } else {
        window.localStorage.setItem(STORAGE_KEY, next);
        window.localStorage.setItem(OVERRIDE_KEY, "1");
        hasManualOverride.current = true;
      }
      applyTheme(next);
      return next;
    });
  }, []);

  const isNight = theme === "night";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isNight}
      title={isNight ? "Switch to day mode" : "Switch to night mode"}
      className={`px-3 py-1.5 rounded-full border border-border text-[10px] uppercase tracking-[0.2em] transition-colors ${
        isNight ? "text-fg/80" : "text-fg/60"
      } hover:text-fg hover:border-fg/30 ${
        mounted ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {isNight ? "night" : "day"}
    </button>
  );
}
