// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CollectionSpec } from "@mdmx/core";
import type { Me } from "../src/api-client.js";
import { resolveConfig } from "../src/config.js";
import { DashboardShell } from "../src/shell/DashboardShell.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const collections: CollectionSpec[] = [
  { name: "posts", dir: "content/posts", fields: [] },
  { name: "pages", dir: "content/pages", fields: [] },
];

async function mountShell(me: Me): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    createElement(
      DashboardShell,
      {
        config: resolveConfig(),
        me,
        collections,
        route: { view: "collection", name: "posts" },
        onLogout: () => {},
        children: createElement("div", { "data-role": "content" }, "hello"),
      },
    ),
  );
  for (let i = 0; i < 8; i++) await flush();
  return host;
}

describe("DashboardShell", () => {
  it("renders nav links for home, collections, media, settings", async () => {
    const el = await mountShell({ login: "octocat", repo: { owner: "o", name: "r", branch: "main" }, contentDir: "content", mediaDir: "public/media", validation: "report", localMode: false });
    const hrefs = Array.from(el.querySelectorAll("nav a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("/mdmx");
    expect(hrefs).toContain("/mdmx/collections/posts");
    expect(hrefs).toContain("/mdmx/collections/pages");
    expect(hrefs).toContain("/mdmx/collections/new");
    expect(hrefs).toContain("/mdmx/media");
    expect(hrefs).toContain("/mdmx/settings");
  });

  it("marks the active collection and renders the main content", async () => {
    const el = await mountShell({ login: "octocat", repo: { owner: "o", name: "r", branch: "main" }, contentDir: "content", mediaDir: "public/media", validation: "report", localMode: false });
    const active = el.querySelector('nav a[aria-current="page"]');
    expect(active?.textContent).toBe("posts");
    expect(el.querySelector('[data-role="content"]')?.textContent).toBe("hello");
  });

  it("shows the local badge (and no logout) for the synthetic local session", async () => {
    const el = await mountShell({ login: "local", repo: { owner: "local", name: "demo", branch: "main" }, contentDir: "content", mediaDir: "public/media", validation: "report", localMode: true });
    expect(el.querySelector(".mdmx-dash-badge")?.textContent).toBe("local");
    expect(el.textContent).not.toContain("Log out");
  });

  it("shows user + logout for a real session", async () => {
    const el = await mountShell({ login: "octocat", repo: { owner: "o", name: "r", branch: "main" }, contentDir: "content", mediaDir: "public/media", validation: "report", localMode: false });
    expect(el.querySelector(".mdmx-dash-badge")).toBeNull();
    expect(el.textContent).toContain("octocat");
    expect(el.textContent).toContain("Log out");
  });
});
