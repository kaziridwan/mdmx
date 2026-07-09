/**
 * Tailwind v4 browser runtime for public pages that render studio components.
 * Theme + utilities only — preflight would reset the mk-* author styles. Only
 * rendered when the page actually contains studio components.
 */
const TAILWIND_SRC = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

const TAILWIND_INPUT = `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);`;

export function StudioTailwindRuntime({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <>
      <style type="text/tailwindcss" dangerouslySetInnerHTML={{ __html: TAILWIND_INPUT }} />
      <script src={TAILWIND_SRC} defer />
    </>
  );
}
