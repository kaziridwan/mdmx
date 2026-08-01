"use client";
import { useEffect, useState, type ReactNode } from "react";
import { UnauthorizedError, type ApiClient, type Me } from "../api-client.js";

type GateState =
  | { phase: "checking" }
  | { phase: "unauthenticated" }
  | { phase: "unreachable"; detail: string }
  | { phase: "ready"; me: Me };

/**
 * Session gate for the dashboard. Asks the API who we are; while GitHub mode
 * shows a real login screen, localMode answers immediately with the synthetic
 * "local" session, so local dev drops straight into the dashboard.
 */
export function AuthGate({
  api,
  loginHref,
  title,
  children,
}: {
  api: ApiClient;
  loginHref: string;
  title: string;
  children: (me: Me) => ReactNode;
}) {
  const [state, setState] = useState<GateState>({ phase: "checking" });

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (!cancelled) setState({ phase: "ready", me });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) setState({ phase: "unauthenticated" });
        else setState({ phase: "unreachable", detail: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (state.phase === "checking") {
    return (
      <div className="mdmx-dash-gate" role="status" aria-label="Checking session">
        <div className="mdmx-dash-spinner" />
      </div>
    );
  }

  if (state.phase === "unreachable") {
    return (
      <div className="mdmx-dash-gate">
        <div className="mdmx-dash-login">
          <h1>{title}</h1>
          <p className="mdmx-dash-error">
            Could not reach the MDMX API: {state.detail}
          </p>
          <p className="mdmx-dash-hint">
            Is the API route mounted? The dashboard expects the handlers from{" "}
            <code>createMDMXHandlers</code> at the configured <code>basePath</code>.
          </p>
        </div>
      </div>
    );
  }

  if (state.phase === "unauthenticated") {
    return (
      <div className="mdmx-dash-gate">
        <div className="mdmx-dash-login">
          <h1>{title}</h1>
          <p>Sign in with a GitHub account that has push access to the content repository.</p>
          <a className="mdmx-dash-button mdmx-dash-button-primary" href={loginHref}>
            Sign in with GitHub
          </a>
        </div>
      </div>
    );
  }

  return <>{children(state.me)}</>;
}
