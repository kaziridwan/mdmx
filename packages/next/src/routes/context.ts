import {
  parseStudioComponent,
  STUDIO_COMPONENTS_DIR,
  type StudioComponentDef,
} from "@mdmx/studio";
import { readText, type ContentProvider } from "@mdmx/core";
import type { ResolvedSettings } from "../settings.js";

/**
 * What a route handler is given (W4).
 *
 * `handle()` used to be one ~355-line closure: every route body inlined,
 * everything sharing state through the closure, nothing independently
 * testable. A route now takes this context instead, so handlers are ordinary
 * functions a test can call directly.
 */
export interface RouteContext {
  settings: ResolvedSettings;
  provider: ContentProvider;
  /** JSON response with the standard headers (no-store, content-type). */
  json: (status: number, body: unknown, headers?: Record<string, string>) => Response;
  /** Re-attaches a refreshed session cookie to a response. */
  withSession: (res: Response) => Response;
}

export interface StudioEntry {
  path: string;
  sha: string;
  def: StudioComponentDef | null;
  problems: string[];
}

/**
 * Stored studio definitions, valid and invalid alike — the caller decides
 * what to do with the broken ones (the API reports them; the registry merge
 * skips them).
 */
export async function listStudioDefs(
  ctx: Pick<RouteContext, "settings" | "provider">,
): Promise<StudioEntry[]> {
  const dir = `${ctx.settings.contentDir}/${STUDIO_COMPONENTS_DIR}`;
  let files;
  try {
    files = await ctx.provider.list(dir);
  } catch {
    return []; // no studio directory yet
  }
  const out: StudioEntry[] = [];
  for (const f of files) {
    if (!f.path.endsWith(".json")) continue;
    const { content, sha } = await readText(ctx.provider, f.path);
    const { def, problems } = parseStudioComponent(content);
    out.push({ path: f.path, sha, def, problems });
  }
  return out;
}
