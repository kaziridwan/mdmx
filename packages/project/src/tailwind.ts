import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Does the host project run Tailwind itself? (ADR-054)
 *
 * Decides how studio component classes reach the page: a Tailwind host
 * compiles them through its own build from the class manifest `mdmx
 * generate` writes; any other host gets a pre-compiled `studio.css`. The
 * editor makes the same call to decide whether the browser runtime is
 * needed.
 *
 * The lookup walks `node_modules` up from the project root — the package may
 * be hoisted by a workspace — but deliberately not Node's global folders or
 * `NODE_PATH`, which say nothing about this project. The package.json
 * dependency lists are the fallback for a checkout without `node_modules`.
 */
export function detectTailwind(root: string): boolean {
  let dir = root;
  for (;;) {
    if (existsSync(join(dir, "node_modules", "tailwindcss", "package.json"))) return true;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Boolean(pkg.dependencies?.tailwindcss ?? pkg.devDependencies?.tailwindcss);
  } catch {
    return false;
  }
}
