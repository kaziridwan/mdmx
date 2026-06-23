/**
 * Reusable HTML snippets ("save as a component"), persisted to localStorage.
 * A snippet is just a named blob of HTML the author can re-insert as an
 * `<Html>` block. Pure data layer (no React); the UI reads/writes through here.
 *
 * Full `.tsx` codegen into the registry needs a build step the in-browser
 * editor can't run, so snippets are the pragmatic stand-in (see ADR-032).
 */

export interface Snippet {
  name: string;
  html: string;
}

const STORAGE_KEY = "mdmx:snippets";

function read(): Snippet[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Snippet =>
        !!s && typeof (s as Snippet).name === "string" && typeof (s as Snippet).html === "string",
    );
  } catch {
    return [];
  }
}

function write(snippets: Snippet[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snippets));
  } catch {
    // ignore (private mode / SSR)
  }
}

/** List saved snippets (newest first). */
export function listSnippets(): Snippet[] {
  return read();
}

/**
 * Save a snippet, upserting by name (trimmed). Empty name/html is ignored.
 * Returns the resulting list.
 */
export function saveSnippet(name: string, html: string): Snippet[] {
  const trimmed = name.trim();
  if (!trimmed || html.trim() === "") return read();
  const rest = read().filter((s) => s.name !== trimmed);
  const next = [{ name: trimmed, html }, ...rest];
  write(next);
  return next;
}

/** Remove a snippet by name. Returns the resulting list. */
export function deleteSnippet(name: string): Snippet[] {
  const next = read().filter((s) => s.name !== name);
  write(next);
  return next;
}
