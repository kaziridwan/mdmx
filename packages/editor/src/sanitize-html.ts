/**
 * Best-effort HTML sanitizer for the `<Html>` custom-markup block. Pure and
 * dependency-free so it runs at build time (no DOM) and in the editor alike.
 *
 * It strips the active-content vectors: `<script>`/`<iframe>`/`<object>`/
 * `<embed>` elements (and their content), document-affecting void tags
 * (`<base>`/`<meta>`/`<link>`), `on*` event-handler attributes, and
 * `javascript:` URLs in `href`/`src`/`xlink:href`.
 *
 * This is a regex pass, not a full HTML parser — adequate for a demo "custom
 * HTML" block, but production untrusted input should go through a real
 * sanitizer (e.g. DOMPurify). Kept intentionally small and unit-tested.
 */

const NESTED_TAGS = ["script", "iframe", "object", "embed"] as const;
const VOID_TAGS = ["base", "meta", "link"] as const;

export function sanitizeHtml(html: string): string {
  let out = html;

  // Elements that carry active content: remove the whole element + its body,
  // plus any stray/self-closing/unclosed opening or closing tags.
  for (const tag of NESTED_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, "gi"), "");
    out = out.replace(new RegExp(`</?${tag}\\b[^>]*>`, "gi"), "");
  }

  // Document-affecting void elements.
  for (const tag of VOID_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>`, "gi"), "");
  }

  // `on*` event-handler attributes (double-quoted, single-quoted, unquoted).
  out = out
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // Neutralize `javascript:` URLs in link/resource attributes.
  out = out
    .replace(/(href|src|xlink:href)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src|xlink:href)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'")
    .replace(/(href|src|xlink:href)\s*=\s*javascript:[^\s>]+/gi, '$1="#"');

  return out;
}
