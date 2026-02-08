"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "night";

const STORAGE_KEY = "hoy-theme";
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

function getInitialTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "night") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "night"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "night" ? "light" : "night";
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

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
