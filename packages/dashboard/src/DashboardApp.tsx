"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Registry, type CollectionSpec, type RegistrySpec } from "@mdmx/core";
import { studioComponentToSpec } from "@mdmx/studio";
import type { ComponentMap } from "@mdmx/editor/react";
import { studioComponent } from "@mdmx/next/render";
import {
  createApiClient,
  type ApiClient,
  type Me,
  type StudioComponentEntry,
} from "./api-client.js";
import type { ResolvedDashboardConfig } from "./config.js";
import { DashboardContext, type DashboardContextValue } from "./context.js";
import { resolveRoute, type DashboardRoute } from "./routes.js";
import { AuthGate } from "./shell/AuthGate.js";
import { DashboardShell } from "./shell/DashboardShell.js";
import { QuickOpen } from "./shell/QuickOpen.js";
import { CollectionFormView } from "./views/CollectionFormView.js";
import { CollectionView } from "./views/CollectionView.js";
import { EditorView } from "./views/EditorView.js";
import { EntryNewView } from "./views/EntryNewView.js";
import { HomeView } from "./views/HomeView.js";
import { MediaView } from "./views/MediaView.js";
import { PlaceholderView } from "./views/PlaceholderView.js";
import { SettingsView } from "./views/SettingsView.js";
import { StudioView } from "./views/StudioView.js";
import { StudioEditorView } from "./views/StudioEditorView.js";
import { applyThemePreference, readThemePreference } from "./theme.js";
import { ensureTailwindRuntime } from "@mdmx/studio/ui";

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

  // Studio components (runtime template components stored in the content
  // repo): fetched after auth, merged into the registry and component map so
  // they behave exactly like code components in the editor. The first fetch
  // gates rendering: a registry identity change re-creates the ProseMirror
  // editor, which must not happen underneath someone already typing.
  const [studioEntries, setStudioEntries] = useState<readonly StudioComponentEntry[]>([]);
  const [studioReady, setStudioReady] = useState(false);
  const refreshStudio = useCallback(async () => {
    setStudioEntries(await api.listStudioComponents());
  }, [api]);

  useEffect(() => {
    refreshStudio()
      .catch(() => {
        // Studio stays empty; the studio views surface their own load errors.
      })
      .finally(() => setStudioReady(true));
  }, [refreshStudio]);

  const effectiveRegistry = useMemo(() => {
    if (studioEntries.length === 0) return registry;
    const taken = new Set(registry.components.map((c) => c.name));
    const merged = [
      ...registry.spec.components,
      ...studioEntries
        .filter((e) => !taken.has(e.def.name))
        .map((e) => studioComponentToSpec(e.def)),
    ];
    return new Registry({ ...registry.spec, components: merged });
  }, [registry, studioEntries]);

  const effectiveComponents = useMemo(() => {
    if (studioEntries.length === 0) return components;
    const studio: ComponentMap = {};
    for (const entry of studioEntries) studio[entry.def.name] = studioComponent(entry.def);
    return { ...studio, ...components };
  }, [components, studioEntries]);

  // Studio components carry Tailwind classes; load the browser runtime so the
  // editor canvas (and studio previews) style them.
  useEffect(() => {
    if (studioEntries.length > 0) ensureTailwindRuntime(config.tailwindSrc);
  }, [studioEntries, config.tailwindSrc]);

  // Re-apply the stored theme pin (settings) on every dashboard load.
  useEffect(() => {
    applyThemePreference(readThemePreference());
  }, []);

  const value: DashboardContextValue = useMemo(
    () => ({
      config,
      api,
      me,
      registry: effectiveRegistry,
      collections,
      refreshCollections,
      components: effectiveComponents,
      studio: { entries: studioEntries, refresh: refreshStudio },
    }),
    [
      config,
      api,
      me,
      effectiveRegistry,
      collections,
      refreshCollections,
      effectiveComponents,
      studioEntries,
      refreshStudio,
    ],
  );

  const onLogout = () => {
    void api.logout().finally(() => window.location.assign(config.mountPath));
  };

  if (!studioReady) {
    return (
      <div className="mdmx-dash-gate" role="status" aria-label="Loading components">
        <div className="mdmx-dash-spinner" />
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={value}>
      <DashboardShell
        config={config}
        me={me}
        collections={collections}
        route={route}
        onLogout={onLogout}
        search={<QuickOpen />}
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
      return <MediaView />;
    case "studio":
      return <StudioView />;
    case "studio-new":
      return <StudioEditorView />;
    case "studio-edit":
      return <StudioEditorView name={route.name} />;
    case "settings":
      return <SettingsView />;
    case "not-found":
      return <PlaceholderView title={`No such page: ${route.slug.join("/")}`} />;
  }
}
