"use client";
import { createContext, useContext } from "react";
import type { CollectionSpec, Registry } from "@mdmx/core";
import type { ComponentMap } from "@mdmx/editor/react";
import type { ApiClient, Me } from "./api-client.js";
import type { ResolvedDashboardConfig } from "./config.js";

/**
 * Everything a dashboard view needs, established once behind the auth gate.
 * `collections` is the request-time set from `GET /collections` (config-as-
 * code, ADR-035) — the baked registry's collections are only the initial
 * value while the first fetch is in flight.
 */
export interface DashboardContextValue {
  config: ResolvedDashboardConfig;
  api: ApiClient;
  me: Me;
  registry: Registry;
  collections: readonly CollectionSpec[];
  /** Re-fetch collections (after create/edit). */
  refreshCollections: () => Promise<void>;
  components?: ComponentMap;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside the dashboard shell");
  return value;
}
