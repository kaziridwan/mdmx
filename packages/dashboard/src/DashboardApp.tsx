"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Registry, type CollectionSpec, type RegistrySpec } from "@mdmx/core";
import type { ComponentMap } from "@mdmx/editor/react";
import { createApiClient, type ApiClient, type Me } from "./api-client.js";
import type { ResolvedDashboardConfig } from "./config.js";
import { DashboardContext, type DashboardContextValue } from "./context.js";
import { resolveRoute, type DashboardRoute } from "./routes.js";
import { AuthGate } from "./shell/AuthGate.js";
import { DashboardShell } from "./shell/DashboardShell.js";
import { CollectionFormView } from "./views/CollectionFormView.js";
import { CollectionView } from "./views/CollectionView.js";
import { EditorView } from "./views/EditorView.js";
import { EntryNewView } from "./views/EntryNewView.js";
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
  const registry = useMemo(() => new Registry(registrySpec), [registrySpec]);
  const api = useMemo(() => createApiClient(config.basePath), [config.basePath]);
  const route = useMemo(() => resolveRoute(slug), [slug]);

  return (
    <AuthGate api={api} loginHref={`${config.basePath}/auth/login`} title={config.title}>
      {(me) => (
        <AuthedDashboard
          config={config}
          api={api}
          me={me}
          registry={registry}
          route={route}
          components={components}
        />
      )}
    </AuthGate>
  );
}

function AuthedDashboard({
  config,
  api,
  me,
  registry,
  route,
  components,
}: {
  config: ResolvedDashboardConfig;
  api: ApiClient;
  me: Me;
  registry: Registry;
  route: DashboardRoute;
  components?: ComponentMap;
}) {
  // The live collection set (config-as-code, resolved by the API per request).
  // The baked registry's collections are only the initial value.
  const [collections, setCollections] = useState<readonly CollectionSpec[]>(
    registry.collections,
  );
  const refreshCollections = useCallback(async () => {
    setCollections(await api.listCollections());
  }, [api]);

  useEffect(() => {
    refreshCollections().catch(() => {
      // Keep the baked fallback; views surface their own load errors.
    });
  }, [refreshCollections]);

  const value: DashboardContextValue = useMemo(
    () => ({ config, api, me, registry, collections, refreshCollections, components }),
    [config, api, me, registry, collections, refreshCollections, components],
  );

  const onLogout = () => {
    void api.logout().finally(() => window.location.assign(config.mountPath));
  };

  return (
    <DashboardContext.Provider value={value}>
      <DashboardShell
        config={config}
        me={me}
        collections={collections}
        route={route}
        onLogout={onLogout}
      >
        <RouteView route={route} />
      </DashboardShell>
    </DashboardContext.Provider>
  );
}

function RouteView({ route }: { route: DashboardRoute }) {
  switch (route.view) {
    case "home":
      return <HomeView />;
    case "collection":
      return <CollectionView name={route.name} />;
    case "collection-new":
      return <CollectionFormView />;
    case "collection-edit":
      return <CollectionFormView editName={route.name} />;
    case "entry-new":
      return <EntryNewView collectionName={route.collection} />;
    case "editor":
      return <EditorView path={route.path} />;
    case "media":
      return <PlaceholderView title="Media" />;
    case "settings":
      return <PlaceholderView title="Settings" />;
    case "not-found":
      return <PlaceholderView title={`No such page: ${route.slug.join("/")}`} />;
  }
}
