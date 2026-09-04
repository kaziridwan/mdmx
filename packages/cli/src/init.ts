import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * `mdmx init <target>` — scaffold the recipe (ADR-041).
 *
 * Create, don't mutate: every file is written only if absent, and
 * `next.config.*` is never rewritten — parsing a user's config-as-code is
 * where scaffolders break trust (comments lost, formatting churned, ESM/CJS/TS
 * variants). The snippet is printed instead, and `mdmx check` warns when
 * `transpilePackages` is missing.
 */

export const INIT_TARGETS = ["nextjs"] as const;
export type InitTarget = (typeof INIT_TARGETS)[number];

export interface InitResult {
  created: string[];
  skipped: string[];
  /** Scripts added to package.json (empty when it already had them). */
  scripts: string[];
  /** Printed for the user to paste — never written by us. */
  nextConfigSnippet: string;
}

const TRANSPILE_PACKAGES = [
  "@mdmx/core",
  "@mdmx/project",
  "@mdmx/studio",
  "@mdmx/editor",
  "@mdmx/next",
  "@mdmx/dashboard",
];

export function nextConfigSnippet(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ${JSON.stringify(TRANSPILE_PACKAGES)},
};

export default nextConfig;`;
}

export function isNextApp(cwd: string): boolean {
  return existsSync(join(cwd, "app")) || existsSync(join(cwd, "src", "app"));
}

export function initNext(cwd: string): InitResult {
  const created: string[] = [];
  const skipped: string[] = [];
  const appDir = existsSync(join(cwd, "src", "app")) ? join("src", "app") : "app";

  const write = (rel: string, content: string): void => {
    const path = join(cwd, rel);
    if (existsSync(path)) {
      skipped.push(rel);
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    created.push(rel);
  };

  write("mdmx.config.json", CONFIG);
  write(join(appDir, "api", "mdmx", "[...route]", "route.ts"), API_ROUTE);
  write(join(appDir, "mdmx", "[[...slug]]", "page.tsx"), DASHBOARD_PAGE);
  write(join("components", "mdmx", "Callout.tsx"), STARTER_COMPONENT);
  write(join("content", "posts", "hello.mdx"), STARTER_ENTRY);

  return {
    created,
    skipped,
    scripts: addScripts(cwd),
    nextConfigSnippet: nextConfigSnippet(),
  };
}

/**
 * package.json is plain JSON, so adding scripts is safe in a way that
 * rewriting next.config.mjs is not.
 */
function addScripts(cwd: string): string[] {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return [];
  const pkg = JSON.parse(readFileSync(path, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = pkg.scripts ?? {};
  const wanted: Record<string, string> = {
    generate: "mdmx generate",
    predev: "mdmx generate",
    prebuild: "mdmx generate",
  };
  const added: string[] = [];
  for (const [name, value] of Object.entries(wanted)) {
    if (scripts[name] === undefined) {
      scripts[name] = value;
      added.push(name);
    }
  }
  if (added.length === 0) return [];
  pkg.scripts = scripts;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  return added;
}

const CONFIG = `{
  "components": "components/mdmx/**/*.{ts,tsx}",
  "contentDir": "content",
  "mediaDir": "public/media",
  "outDir": ".mdmx",
  "collections": {
    "posts": {
      "dir": "content/posts",
      "fields": {
        "title": { "control": { "type": "text" }, "required": true },
        "status": {
          "control": { "type": "select", "options": ["draft", "private", "published"] },
          "required": true,
          "default": "draft"
        },
        "description": { "control": { "type": "textarea" } }
      }
    }
  }
}
`;

const API_ROUTE = `import { createMDMXHandlers } from "@mdmx/next";

// Content and media API. Directories, collections, the registry, the mode,
// and the provider all resolve from mdmx.config.json and the environment.
// Set MDMX_GITHUB_CLIENT_ID / _SECRET and MDMX_SESSION_SECRET to run this
// same file against GitHub in production.
export const { GET, POST, PUT, DELETE } = createMDMXHandlers();

export const dynamic = "force-dynamic";
`;

const DASHBOARD_PAGE = `import { createDashboardPage } from "@mdmx/dashboard/next";
import { components } from "../../../.mdmx/components";

export default createDashboardPage({ components });
export const dynamic = "force-dynamic";
`;

const STARTER_COMPONENT = `import { defineMDMX } from "@mdmx/core";

interface CalloutProps {
  /** Short label shown in the header. */
  title?: string;
  variant?: "info" | "warn" | "danger";
  children?: React.ReactNode;
}

function CalloutImpl({ title, variant = "info", children }: CalloutProps) {
  return (
    <aside data-variant={variant}>
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </aside>
  );
}

export const Callout = defineMDMX(CalloutImpl, {
  name: "Callout",
  category: "Content",
  icon: "alert-circle",
  description: "Highlighted box for notes and warnings",
  children: "rich-text",
  // What a freshly inserted block holds (props over defaults + first paragraph).
  preview: { variant: "info", title: "Heads up", children: "Something worth knowing." },
});
`;

const STARTER_ENTRY = `---
title: Hello
status: published
---

# Hello

Your components are editable blocks.

<Callout variant="info" title="Try it">
  Open /mdmx and edit this entry.
</Callout>
`;

/** Human-readable summary for the CLI to print. */
export function formatInitResult(result: InitResult): string {
  const lines: string[] = [];
  for (const file of result.created) lines.push(`  created  ${file}`);
  for (const file of result.skipped) lines.push(`  skipped  ${file} (already exists)`);
  if (result.scripts.length > 0) {
    lines.push(`  updated  package.json (scripts: ${result.scripts.join(", ")})`);
  }
  lines.push("");
  lines.push("Add this to next.config.mjs (we don't edit it for you):");
  lines.push("");
  lines.push(
    result.nextConfigSnippet
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n"),
  );
  lines.push("");
  lines.push("Then: pnpm dev  →  open /mdmx");
  return lines.join("\n");
}
