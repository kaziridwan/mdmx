"use client";
import { useMemo } from "react";
import { Registry, type RegistrySpec } from "@mdmx/core";
import type { ComponentMap } from "@mdmx/editor/react";
import { createApiClient } from "./api-client.js";
import type { ResolvedDashboardConfig } from "./config.js";
import { resolveRoute } from "./routes.js";
import { AuthGate } from "./shell/AuthGate.js";
import { DashboardShell } from "./shell/DashboardShell.js";
import { HomeView } from "./views/HomeView.js";
import { PlaceholderView } from "./views/PlaceholderView.js";

/**
 * Client root of the dashboard. The server page hands us the slug segments,
 * the registry spec (plain JSON), and the resolved config; everything else is
 * fetched through the content API so the same UI works in localMode and
 * GitHub mode.
 */
export function DashboardApp({
  slug,
  registrySpec,
  config,
  components,
}: {
  slug: string[];
  registrySpec: RegistrySpec;
  config: ResolvedDashboardConfig;
  /** Author components (client references) for live rendering in the editor. */
  components?: ComponentMap;
}) {
  void components; // threaded to the editor view in M4
  const registry = useMemo(() => new Registry(registrySpec), [registrySpec]);
  const api = useMemo(() => createApiClient(config.basePath), [config.basePath]);
  const route = useMemo(() => resolveRoute(slug), [slug]);

  const onLogout = () => {
    void api.logout().finally(() => window.location.assign(config.mountPath));
  };

  return (
    <AuthGate api={api} loginHref={`${config.basePath}/auth/login`} title={config.title}>
      {(me) => (
        <DashboardShell
          config={config}
          me={me}
          collections={registry.collections}
          route={route}
          onLogout={onLogout}
        >
          {renderView()}
        </DashboardShell>
      )}
    </AuthGate>
  );

  function renderView() {
    switch (route.view) {
      case "home":
        return <HomeView config={config} collections={registry.collections} />;
      case "collection":
        return <PlaceholderView title={route.name} />;
      case "collection-new":
        return <PlaceholderView title="New collection" />;
      case "collection-edit":
        return <PlaceholderView title={`Edit ${route.name}`} />;
      case "entry-new":
        return <PlaceholderView title={`New ${route.collection} entry`} />;
      case "editor":
        return <PlaceholderView title={route.path.join("/")} />;
      case "media":
        return <PlaceholderView title="Media" />;
      case "settings":
        return <PlaceholderView title="Settings" />;
      case "not-found":
        return <PlaceholderView title={`No such page: ${route.slug.join("/")}`} />;
    }
  }
}
