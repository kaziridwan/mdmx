/**
 * Tailwind v4 browser runtime, loaded on demand wherever studio components
 * render (studio views, editor canvas). The injected stylesheet imports theme
 * + utilities only — no preflight, which would reset the dashboard chrome and
 * author `mk-*` styles around it. Idempotent; safe to call from effects.
 */

const SCRIPT_ID = "mdmx-tailwind-runtime";

export const DEFAULT_TAILWIND_SRC = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

export function ensureTailwindRuntime(src: string = DEFAULT_TAILWIND_SRC): void {
  if (typeof document === "undefined" || document.getElementById(SCRIPT_ID)) return;
  const style = document.createElement("style");
  style.setAttribute("type", "text/tailwindcss");
  style.textContent = `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);`;
  document.head.appendChild(style);
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = src;
  script.defer = true;
  document.head.appendChild(script);
}
