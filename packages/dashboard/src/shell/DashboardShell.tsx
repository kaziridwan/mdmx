"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "./link.js";
import type { CollectionSpec } from "@mdmx/core";
import type { Me } from "../api-client.js";
import type { ResolvedDashboardConfig } from "../config.js";
import { routeHref, type DashboardRoute } from "../routes.js";
import {
  isEditableTarget,
  isNavToggleShortcut,
  readStoredNavCollapsed,
  storeNavCollapsed,
} from "./nav-state.js";

const NAV_ID = "mdmx-dash-side";

/**
 * The dashboard chrome: top navbar, left nav sidebar, main content area, and
 * an optional contextual right panel supplied by the active view. Pure layout
 * — data loading lives in the views. The left nav collapses from the navbar
 * (or `Mod-\`), persisted per browser (ADR-056).
 */
export function DashboardShell({
  config,
  me,
  collections,
  route,
  onLogout,
  search,
  context,
  children,
}: {
  config: ResolvedDashboardConfig;
  me: Me;
  collections: readonly CollectionSpec[];
  route: DashboardRoute;
  onLogout: () => void;
  /** Search / quick-open trigger rendered in the navbar (kept as a slot so the shell stays context-free). */
  search?: ReactNode;
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

  const [navCollapsed, setNavCollapsed] = useState(() => readStoredNavCollapsed() ?? false);
  const toggleNav = useCallback(() => {
    setNavCollapsed((current) => {
      storeNavCollapsed(!current);
      return !current;
    });
  }, []);

  // Mod-\ toggles the nav from anywhere except inside a text editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isNavToggleShortcut(e) || isEditableTarget(e.target)) return;
      e.preventDefault();
      toggleNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleNav]);

  return (
    <div className={"mdmx-dash" + (navCollapsed ? " is-nav-collapsed" : "")}>
      <header className="mdmx-dash-nav">
        <button
          type="button"
          className="mdmx-dash-nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={!navCollapsed}
          aria-controls={NAV_ID}
          title={navCollapsed ? "Show navigation (⌘\\)" : "Hide navigation (⌘\\)"}
          onClick={toggleNav}
        >
          <svg
            viewBox="0 0 24 24"
            width={15}
            height={15}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="9" y1="4" x2="9" y2="20" />
          </svg>
        </button>
        <Link className="mdmx-dash-brand" href={mountPath}>
          {config.title}
        </Link>
        {search}
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
        <nav id={NAV_ID} className="mdmx-dash-side" aria-label="Dashboard">
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
            <SideLink
              href={routeHref(mountPath, "studio")}
              active={
                route.view === "studio" ||
                route.view === "studio-new" ||
                route.view === "studio-edit"
              }
            >
              Studio
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
