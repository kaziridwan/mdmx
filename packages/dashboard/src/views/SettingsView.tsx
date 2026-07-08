"use client";
import { useState } from "react";
import { useDashboard } from "../context.js";
import {
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from "../theme.js";

/** Settings: session, repo wiring, validation mode, registry stats, theme. */
export function SettingsView() {
  const { config, me, registry, collections, api } = useDashboard();
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference());

  const onTheme = (pref: ThemePreference) => {
    setTheme(pref);
    applyThemePreference(pref);
  };

  const onLogout = () => {
    void api.logout().finally(() => window.location.assign(config.mountPath));
  };

  return (
    <div className="mdmx-dash-view mdmx-dash-view-narrow">
      <header className="mdmx-dash-view-head">
        <h1>Settings</h1>
      </header>

      <section className="mdmx-dash-settings-section">
        <h2>Session</h2>
        <dl className="mdmx-dash-dl">
          <dt>Signed in as</dt>
          <dd>
            {me.login}
            {me.localMode ? <span className="mdmx-dash-badge">local</span> : null}
          </dd>
          <dt>Repository</dt>
          <dd>
            <code>
              {me.repo.owner}/{me.repo.name}
            </code>{" "}
            on <code>{me.repo.branch}</code>
          </dd>
        </dl>
        {me.localMode ? (
          <p className="mdmx-dash-hint">
            localMode: no authentication; saves write to the working tree. Commit them
            with git. Never enable in production.
          </p>
        ) : (
          <button type="button" className="mdmx-dash-button" onClick={onLogout}>
            Log out
          </button>
        )}
      </section>

      <section className="mdmx-dash-settings-section">
        <h2>Content</h2>
        <dl className="mdmx-dash-dl">
          <dt>Content directory</dt>
          <dd>
            <code>{me.contentDir}/</code>
          </dd>
          <dt>Media directory</dt>
          <dd>
            <code>{me.mediaDir}/</code>
          </dd>
          <dt>Save validation</dt>
          <dd>
            <code>{me.validation}</code>
            <span className="mdmx-dash-field-hint">
              {me.validation === "strict"
                ? " — saves with error diagnostics are rejected"
                : " — saves land and diagnostics are reported"}
            </span>
          </dd>
          <dt>Registry</dt>
          <dd>
            {registry.components.length} component{registry.components.length === 1 ? "" : "s"},{" "}
            {collections.length} collection{collections.length === 1 ? "" : "s"}
          </dd>
        </dl>
      </section>

      <section className="mdmx-dash-settings-section">
        <h2>Appearance</h2>
        <div className="mdmx-dash-theme-row" role="radiogroup" aria-label="Theme">
          {(["system", "light", "dark"] as const).map((pref) => (
            <button
              key={pref}
              type="button"
              role="radio"
              aria-checked={theme === pref}
              className={
                "mdmx-dash-button" + (theme === pref ? " mdmx-dash-button-primary" : "")
              }
              onClick={() => onTheme(pref)}
            >
              {pref}
            </button>
          ))}
        </div>
        <p className="mdmx-dash-hint">Stored in this browser; “system” follows the OS.</p>
      </section>
    </div>
  );
}
