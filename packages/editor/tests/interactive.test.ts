// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseMDX, toMDX, Registry, type RegistrySpec } from "@mdmx/core";
import { buildSchema } from "../src/schema.js";
import { fromMdast } from "../src/from-mdast.js";
import { toMdast } from "../src/to-mdast.js";
import { routeEvent, INTERACTIVE_SELECTOR } from "../src/react/react-node-view.js";
import { linkClickAction } from "../src/react/link-policy.js";
import { MDMXEditor } from "../src/react/index.js";

// ---------------------------------------------------------------------------
// routeEvent — the pure routing policy behind NodeView.stopEvent (ADR-052)
// ---------------------------------------------------------------------------

function block(html: string): { dom: HTMLElement; contentDOM: HTMLElement | undefined } {
  const dom = document.createElement("div");
  dom.className = "mdmx-nodeview";
  dom.innerHTML = html;
  document.body.appendChild(dom);
  return { dom, contentDOM: dom.querySelector<HTMLElement>(".mdmx-contentdom") ?? undefined };
}

const fire = (el: Element, type = "mousedown", init: MouseEventInit = {}) => {
  const event = new MouseEvent(type, { bubbles: true, ...init });
  let captured: Event | null = null;
  el.addEventListener(type, (e) => (captured = e), { once: true });
  el.dispatchEvent(event);
  return captured!;
};

describe("routeEvent (default policy: by target)", () => {
  afterEach(() => document.body.replaceChildren());

  it("hands events on interactive elements to the component", () => {
    const { dom, contentDOM } = block(
      `<section><button>Vote</button><input type="email"><div role="tab">Tab</div><span class="text">plain</span></section>`,
    );
    expect(routeEvent(fire(dom.querySelector("button")!), dom, contentDOM, undefined)).toBe(true);
    expect(routeEvent(fire(dom.querySelector("input")!), dom, contentDOM, undefined)).toBe(true);
    expect(routeEvent(fire(dom.querySelector("[role=tab]")!), dom, contentDOM, undefined)).toBe(true);
  });

  it("lets everything else select the block", () => {
    const { dom, contentDOM } = block(`<section><span class="text">plain</span><a href="/x">link</a></section>`);
    expect(routeEvent(fire(dom.querySelector(".text")!), dom, contentDOM, undefined)).toBe(false);
    // Links are not interactive: they select, and navigation is suppressed elsewhere.
    expect(routeEvent(fire(dom.querySelector("a")!), dom, contentDOM, undefined)).toBe(false);
  });

  it("the editable hole is always the editor's", () => {
    const { dom, contentDOM } = block(
      `<aside><div class="mdmx-contentdom"><p><button>inside hole</button></p></div><button>chrome</button></aside>`,
    );
    expect(routeEvent(fire(dom.querySelector(".mdmx-contentdom button")!), dom, contentDOM, undefined)).toBe(false);
    expect(routeEvent(fire(dom.querySelector(".mdmx-contentdom button")!), dom, contentDOM, true)).toBe(false);
    expect(routeEvent(fire(dom.querySelector("aside > button")!), dom, contentDOM, undefined)).toBe(true);
  });

  it("interactive: true routes everything to the component, Alt-click excepted", () => {
    const { dom, contentDOM } = block(`<section><span class="text">plain</span></section>`);
    const span = dom.querySelector(".text")!;
    expect(routeEvent(fire(span), dom, contentDOM, true)).toBe(true);
    expect(routeEvent(fire(span, "mousedown", { altKey: true }), dom, contentDOM, true)).toBe(false);
  });

  it("interactive: false routes everything to the editor", () => {
    const { dom, contentDOM } = block(`<section><button>Vote</button></section>`);
    expect(routeEvent(fire(dom.querySelector("button")!), dom, contentDOM, false)).toBe(false);
  });

  it("ignores events from outside the block", () => {
    const { dom, contentDOM } = block(`<section><button>Vote</button></section>`);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    expect(routeEvent(fire(outside), dom, contentDOM, undefined)).toBe(false);
    expect(routeEvent(fire(outside), dom, contentDOM, true)).toBe(false);
  });

  it("the interactive selector covers the roles the policy names", () => {
    for (const role of ["button", "tab", "switch", "checkbox", "radio", "slider", "menuitem", "option", "combobox", "textbox", "spinbutton"]) {
      const el = document.createElement("div");
      el.setAttribute("role", role);
      expect(el.matches(INTERACTIVE_SELECTOR), role).toBe(true);
    }
    const link = document.createElement("a");
    link.setAttribute("role", "link");
    expect(link.matches(INTERACTIVE_SELECTOR)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// linkClickAction — links never navigate in the canvas
// ---------------------------------------------------------------------------

describe("linkClickAction", () => {
  afterEach(() => document.body.replaceChildren());

  it("suppresses plain clicks and opens ⌘/Ctrl-clicks", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p><a href="https://example.com/x"><strong>go</strong></a></p>`;
    document.body.appendChild(root);
    const strong = root.querySelector("strong")!;
    expect(linkClickAction(fire(strong, "click"), root)?.action).toBe("suppress");
    expect(linkClickAction(fire(strong, "click", { metaKey: true }), root)?.action).toBe("open");
    expect(linkClickAction(fire(strong, "click", { ctrlKey: true }), root)?.action).toBe("open");
    expect(linkClickAction(fire(strong, "click"), root)?.anchor.href).toBe("https://example.com/x");
  });

  it("is null for non-links and for links outside the root", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p><span>text</span></p>`;
    const outside = document.createElement("a");
    outside.href = "https://example.com/";
    document.body.append(root, outside);
    expect(linkClickAction(fire(root.querySelector("span")!, "click"), root)).toBeNull();
    expect(linkClickAction(fire(outside, "click"), root)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// render.interactive is editor metadata: content round-trips untouched
// ---------------------------------------------------------------------------

const spec: RegistrySpec = {
  mdmxRegistryVersion: 2,
  components: [
    {
      name: "Poll",
      children: { policy: "none" },
      props: [{ name: "question", required: true, control: { type: "text" } }],
      render: { mode: "live", interactive: true },
    },
    {
      name: "Card",
      children: { policy: "rich-text" },
      props: [],
      render: { mode: "live", interactive: false },
    },
  ],
};

describe("render.interactive and content", () => {
  it("leaves canonical MDMX byte-identical", () => {
    const registry = new Registry(spec);
    const schema = buildSchema(registry);
    const source = `<Poll question="Tabs or spaces?" />

<Card>
  Inside the [card](https://example.com/).
</Card>
`;
    const doc = fromMdast(parseMDX(source), { schema, registry, source });
    expect(toMDX(toMdast(doc, { registry }))).toBe(source);
  });
});

// ---------------------------------------------------------------------------
// Mounted editor: the canvas-wide link policy is live
// ---------------------------------------------------------------------------

const Poll = (props: { question?: string }) =>
  createElement("form", null, createElement("a", { href: "https://example.com/vote", "data-role": "vote" }, props.question));
const Card = (props: { children?: ReactNode }) => createElement("div", { "data-role": "card" }, props.children);

const flush = () => new Promise((r) => setTimeout(r, 0));
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  root?.unmount();
  host?.remove();
  root = host = null;
  vi.restoreAllMocks();
});

describe("links in the canvas", () => {
  it("never navigate; ⌘-click opens a new tab", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    root.render(
      createElement(MDMXEditor, {
        registry: new Registry(spec),
        components: { Poll, Card },
        source: `<Poll question="Tabs?" />\n`,
      }),
    );
    for (let i = 0; i < 8; i++) await flush();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const link = host.querySelector('[data-role="vote"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();

    const plain = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(open).not.toHaveBeenCalled();

    const meta = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });
    link.dispatchEvent(meta);
    expect(meta.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith("https://example.com/vote", "_blank", "noopener,noreferrer");
  });
});
