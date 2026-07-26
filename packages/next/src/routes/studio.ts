import { assertSafePath } from "@mdmx/core";
import {
  studioComponentPath,
  studioComponentToSpec,
  studioComponentToTSX,
  validateStudioComponent,
  type StudioComponentDef,
} from "@mdmx/studio";
import { listStudioDefs, type RouteContext } from "./context.js";

/**
 * Component Studio routes: list, save, delete, eject.
 *
 * These carry the riskiest writes in the API — a save that skipped validation
 * would put unrenderable JSON in the content repo, and eject writes a real
 * source file — and they were the one route family with no tests at all
 * (review §3.4). Splitting them out is what makes them testable.
 */
export async function handleStudioRoute(
  ctx: RouteContext,
  req: Request,
  route: string,
  method: string,
): Promise<Response | null> {
  const { json, withSession, provider, settings } = ctx;

  if (route === "/studio/components" && method === "GET") {
    const entries = await listStudioDefs(ctx);
    return withSession(
      json(200, {
        components: entries
          .filter((e) => e.def != null)
          .map((e) => ({ path: e.path, sha: e.sha, def: e.def })),
        // Broken definitions are reported, not hidden: a component that
        // vanishes from the palette with no explanation is worse.
        invalid: entries
          .filter((e) => e.def == null)
          .map((e) => ({ path: e.path, problems: e.problems })),
      }),
    );
  }

  const componentRoute = route.match(/^\/studio\/components\/([^/]+)$/);

  if (componentRoute && method === "PUT") {
    const name = decodeURIComponent(componentRoute[1]!);
    const body = (await req.json()) as {
      def?: unknown;
      message?: string;
      expectedSha?: string | null;
    };
    const defName = (body.def as Partial<StudioComponentDef> | undefined)?.name;
    if (defName !== name) {
      return withSession(json(400, { error: "definition name must match the route" }));
    }
    // Collisions: the baked code registry plus every OTHER stored definition.
    const taken = new Set<string>(settings.registry?.components.map((c) => c.name) ?? []);
    for (const entry of await listStudioDefs(ctx)) {
      if (entry.def && entry.def.name !== name) taken.add(entry.def.name);
    }
    const problems = validateStudioComponent(body.def, taken);
    if (problems.length > 0) {
      return withSession(json(400, { error: "invalid studio component", problems }));
    }
    const path = studioComponentPath(settings.contentDir, name);
    const result = await provider.commit(
      [{ path, content: JSON.stringify(body.def, null, 2) + "\n" }],
      body.message ?? `mdmx: studio component ${name}`,
      body.expectedSha !== undefined ? { expectedShas: { [path]: body.expectedSha } } : undefined,
    );
    return withSession(
      json(200, {
        commit: result,
        path,
        spec: studioComponentToSpec(body.def as StudioComponentDef),
      }),
    );
  }

  if (componentRoute && method === "DELETE") {
    const name = decodeURIComponent(componentRoute[1]!);
    const path = studioComponentPath(settings.contentDir, name);
    const result = await provider.commit(
      [{ path, delete: true }],
      `mdmx: delete studio component ${name}`,
    );
    return withSession(json(200, { commit: result }));
  }

  // Eject: write the definition as a real defineMDMX TSX file. The JSON
  // definition stays put — it keeps the component working at runtime until
  // `mdmx generate` + a rebuild promote the code version, which then shadows
  // it everywhere (the code-beats-studio merge rule).
  const ejectRoute = route.match(/^\/studio\/components\/([^/]+)\/eject$/);
  if (ejectRoute && method === "POST") {
    const name = decodeURIComponent(ejectRoute[1]!);
    const stored = (await listStudioDefs(ctx)).find((e) => e.def?.name === name);
    if (!stored?.def) {
      return withSession(json(404, { error: `no studio component "${name}"` }));
    }
    const path = assertSafePath(`${settings.componentsDir}/${name}.tsx`);
    const result = await provider.commit(
      [{ path, content: studioComponentToTSX(stored.def) }],
      `mdmx: eject studio component ${name} to code`,
      { expectedShas: { [path]: null } }, // never overwrite an existing file
    );
    return withSession(
      json(201, {
        commit: result,
        path,
        note:
          "Run `mdmx generate` and rebuild to promote the code component; " +
          "the studio definition keeps working until then and can be deleted after.",
      }),
    );
  }

  return null; // not a studio route
}
