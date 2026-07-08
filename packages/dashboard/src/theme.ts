"use client";

/**
 * Theme preference: "system" defers to prefers-color-scheme (the stylesheet's
 * default); "light"/"dark" pin via the data-mdmx-theme attribute the token
 * blocks key off. Persisted per browser in localStorage.
 */
export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "mdmx-theme";

export function readThemePreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch {
    return "system";
  }
}

export function applyThemePreference(pref: ThemePreference): void {
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.mdmxTheme;
  else root.dataset.mdmxTheme = pref;
  try {
    if (pref === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage unavailable (private mode) — the attribute still applies.
  }
}
