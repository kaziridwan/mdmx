// @mdmx/dashboard/next — the Next.js server glue.
//
// The canonical mount is two ~3-line files:
//
//   // app/mdmx/[[...slug]]/page.tsx
//   import { createDashboardPage } from "@mdmx/dashboard/next";
//   import { components } from "../../../lib/components";
//   export default createDashboardPage({ components });
//   export const dynamic = "force-dynamic";
//
//   // app/api/mdmx/[...route]/route.ts
//   import { createMDMXHandlers, LocalProvider } from "@mdmx/dashboard/next";
//   export const { GET, POST, PUT, DELETE } = createMDMXHandlers({ ... });
//   export const dynamic = "force-dynamic";
import "../styles.css";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import type { RegistrySpec } from "@mdmx/core";
import type { ComponentMap } from "@mdmx/editor/react";
import { DashboardApp } from "../DashboardApp.js";
import { resolveConfig, type DashboardConfig } from "../config.js";

export interface DashboardPageOptions extends DashboardConfig {
  /**
   * Author components for live rendering in the embedded editor, keyed by
   * registry name. Import them from a `"use client"` module so they cross to
   * the client as references.
   */
  components?: ComponentMap;
}

export interface DashboardPageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Build the dashboard page component for an optional catch-all route
 * (`app/<mount>/[[...slug]]/page.tsx`). The server side stays thin: it reads
 * the registry spec off disk per request and hands everything to the client
 * app, which talks to the content API from there.
 */
export function createDashboardPage(options: DashboardPageOptions = {}) {
  const { components, ...config } = options;
  const resolved = resolveConfig(config);

  return async function MDMXDashboardPage({ params }: DashboardPageProps) {
    const { slug = [] } = await params;
    const registryPath = join(process.cwd(), resolved.registryPath);
    let spec: RegistrySpec;
    try {
      spec = JSON.parse(readFileSync(registryPath, "utf8")) as RegistrySpec;
    } catch (err) {
      throw new Error(
        `MDMX dashboard: could not read the registry at ${registryPath}. ` +
          `Run \`mdmx generate\` (usually via a predev/prebuild script) before starting the app. ` +
          `(${(err as Error).message})`,
      );
    }
    return createElement(DashboardApp, {
      slug,
      registrySpec: spec,
      config: resolved,
      components,
    });
  };
}

// Everything the API route file needs, re-exported so both mount files can
// import from @mdmx/dashboard/next.
export * from "@mdmx/next";
export type { DashboardConfig } from "../config.js";
