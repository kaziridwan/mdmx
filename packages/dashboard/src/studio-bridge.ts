"use client";
import { useMemo } from "react";
import type { StudioClient, StudioHost } from "@mdmx/studio/ui";
import { useDashboard } from "./context.js";
import { Link } from "./shell/link.js";
import { routeHref } from "./routes.js";

/**
 * Implements `@mdmx/studio/ui`'s host contract from the dashboard's context:
 * the typed API client becomes a `StudioClient`, and routing/chrome become a
 * `StudioHost`. This is the whole coupling between the two packages — the
 * studio screens never see the dashboard's context or api-client types.
 */
export function useStudioBridge(): { client: StudioClient; host: StudioHost } {
  const { config, api, studio } = useDashboard();

  return useMemo(
    () => ({
      client: {
        entries: studio.entries,
        refresh: () => studio.refresh(),
        save: async ({ def, expectedSha }) => {
          await api.saveStudioComponent({ def, expectedSha });
        },
        remove: async (name) => {
          await api.deleteStudioComponent(name);
        },
        eject: (name) => api.ejectStudioComponent(name),
      },
      host: {
        contentDir: config.contentDir ?? "content",
        hrefFor: (...segments: string[]) => routeHref(config.mountPath, ...segments),
        navigate: (href: string) => window.location.assign(href),
        Link,
        tailwindSrc: config.tailwindSrc,
      },
    }),
    [api, config.contentDir, config.mountPath, config.tailwindSrc, studio],
  );
}
