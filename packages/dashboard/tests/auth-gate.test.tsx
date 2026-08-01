// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createApiClient, type Me } from "../src/api-client.js";
import { AuthGate } from "../src/shell/AuthGate.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function mountGate(): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    createElement(AuthGate, {
      api: createApiClient("/api/mdmx"),
      loginHref: "/api/mdmx/auth/login",
      title: "MDMX",
      children: (me: Me) => createElement("div", { "data-role": "app" }, me.login),
    }),
  );
  for (let i = 0; i < 8; i++) await flush();
  return host;
}

describe("AuthGate", () => {
  it("renders the app with the session when /me succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          login: "octocat",
          repo: { owner: "o", name: "r", branch: "main" },
          contentDir: "content",
          mediaDir: "public/media",
          validation: "report",
          localMode: false,
        }),
      ),
    );
    const el = await mountGate();
    expect(el.querySelector('[data-role="app"]')?.textContent).toBe("octocat");
  });

  it("shows the GitHub login screen on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, { error: "authentication required" })),
    );
    const el = await mountGate();
    expect(el.querySelector('[data-role="app"]')).toBeNull();
    const link = el.querySelector("a.mdmx-dash-button") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/api/mdmx/auth/login");
    expect(el.textContent).toContain("push access");
  });

  it("explains when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const el = await mountGate();
    expect(el.textContent).toContain("Could not reach the MDMX API");
    expect(el.textContent).toContain("createMDMXHandlers");
  });
});
