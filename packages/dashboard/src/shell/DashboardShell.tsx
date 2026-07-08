"use client";
import type { ReactNode } from "react";
import { Link } from "./link.js";
import type { CollectionSpec } from "@mdmx/core";
import type { Me } from "../api-client.js";
import type { ResolvedDashboardConfig } from "../config.js";
import { routeHref, type DashboardRoute } from "../routes.js";

/**
 * The dashboard chrome: top navbar, left nav sidebar, main content area, and
 * an optional contextual right panel supplied by the active view. Pure layout
 * — data loading lives in the views.
 */
export function DashboardShell({
  config,
  me,
  collections,
  route,
  onLogout,
  context,
  children,
}: {
  config: ResolvedDashboardConfig;
  me: Me;
  collections: readonly CollectionSpec[];
  route: DashboardRoute;
  onLogout: () => void;
  /** Contextual right panel; views that manage their own chrome pass nothing. */
  context?: ReactNode;
  children: ReactNode;
}) {
  const { mountPath } = config;
  const isLocal = me.login === "local";
  const activeCollection =
    route.view === "collection" || route.view === "collection-edit"
      ? route.name
      : route.view === "entry-new"
        ? route.collection
        : null;

  return (
    <div className="mdmx-dash">
      <header className="mdmx-dash-nav">
        <Link className="mdmx-dash-brand" href={mountPath}>
          {config.title}
        </Link>
        <div className="mdmx-dash-nav-spacer" />
        <span className="mdmx-dash-repo" title={`branch ${me.repo.branch}`}>
          {me.repo.owner}/{me.repo.name}
        </span>
        {isLocal ? (
          <span className="mdmx-dash-badge" title="localMode: no auth, saves to the working tree">
            local
          </span>
        ) : (
          <>
            <span className="mdmx-dash-user">{me.login}</span>
            <button type="button" className="mdmx-dash-button mdmx-dash-button-ghost" onClick={onLogout}>
              Log out
            </button>
          </>
        )}
      </header>

      <div className="mdmx-dash-body">
        <nav className="mdmx-dash-side" aria-label="Dashboard">
          <SideLink href={mountPath} active={route.view === "home"}>
            Home
          </SideLink>

          <div className="mdmx-dash-side-group">
            <div className="mdmx-dash-side-heading">
              <span>Collections</span>
              <Link
                className="mdmx-dash-side-action"
                href={routeHref(mountPath, "collections", "new")}
                aria-label="New collection"
                title="New collection"
              >
                +
              </Link>
            </div>
            {collections.length === 0 ? (
              <span className="mdmx-dash-side-empty">none yet</span>
            ) : (
              collections.map((c) => (
                <SideLink
                  key={c.name}
                  href={routeHref(mountPath, "collections", c.name)}
                  active={activeCollection === c.name}
                >
                  {c.name}
                </SideLink>
              ))
            )}
          </div>

          <div className="mdmx-dash-side-group">
            <SideLink href={routeHref(mountPath, "media")} active={route.view === "media"}>
              Media
            </SideLink>
            <SideLink href={routeHref(mountPath, "settings")} active={route.view === "settings"}>
              Settings
            </SideLink>
          </div>
        </nav>

        <main className="mdmx-dash-main">{children}</main>

        {context ? <aside className="mdmx-dash-context">{context}</aside> : null}
      </div>
    </div>
  );
}

function SideLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      className={"mdmx-dash-side-link" + (active ? " is-active" : "")}
      aria-current={active ? "page" : undefined}
      href={href}
    >
      {children}
    </Link>
  );
}
