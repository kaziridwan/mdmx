// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { TemplateElement } from "../src/index.js";
import { htmlToTemplate, templateToHtml } from "../src/ui/template-html.js";
import {
  activeClassIn,
  appendChild,
  CLASS_GROUPS,
  ELEMENT_SNIPPETS,
  isElement,
  nodeAtPath,
  removeAtPath,
  setClassIn,
  updateAtPath,
} from "../src/ui/template-edit.js";

/**
 * The template model's pure logic — 330 lines that had no tests while they
 * lived in the dashboard (review §3.4 called these the cheapest wins
 * available). Moving the studio UI into its own package is what made them
 * reachable.
 */

const tree: TemplateElement = {
  tag: "div",
  classes: "rounded p-4",
  children: [
    { tag: "h3", classes: "text-lg", children: [{ text: "Title" }] },
    { tag: "p", children: [{ text: "Body {props.body}" }] },
  ],
};

describe("htmlToTemplate", () => {
  it("parses markup into the restricted tree", () => {
    const { template, problems } = htmlToTemplate(
      '<div class="rounded"><h3>Hi</h3><p>Text</p></div>',
    );
    expect(problems).toEqual([]);
    expect(template?.tag).toBe("div");
    expect(template?.classes).toBe("rounded");
    expect(template?.children).toHaveLength(2);
  });

  it("drops disallowed tags and says which ones — HTML is only an input format", () => {
    const { template, problems } = htmlToTemplate(
      '<div><script>alert(1)</script><p>ok</p></div>',
    );
    expect(problems.join(" ")).toContain("script");
    const tags = (template?.children ?? []).filter(isElement).map((c) => c.tag);
    expect(tags).toEqual(["p"]);
  });

  it("drops disallowed attributes but keeps the element", () => {
    const { template, problems } = htmlToTemplate('<div onclick="steal()">hi</div>');
    expect(template?.tag).toBe("div");
    expect(template?.attrs?.onclick).toBeUndefined();
    expect(problems.join(" ")).toContain("onclick");
  });

  it("preserves {props.x} placeholders verbatim", () => {
    const { template } = htmlToTemplate('<p title="{props.tip}">Hello {props.name}</p>');
    expect(JSON.stringify(template)).toContain("{props.name}");
    expect(template?.attrs?.title).toBe("{props.tip}");
  });
});

describe("templateToHtml", () => {
  it("serializes a tree back to markup", () => {
    const html = templateToHtml(tree);
    expect(html).toContain('<div class="rounded p-4">');
    expect(html).toContain("<h3");
    expect(html).toContain("Body {props.body}");
  });

  it("round-trips: html → tree → html is stable", () => {
    const once = templateToHtml(tree);
    const { template } = htmlToTemplate(once);
    expect(template).not.toBeNull();
    expect(templateToHtml(template!)).toBe(once);
  });
});

describe("tree editing", () => {
  it("addresses nodes by path", () => {
    expect(nodeAtPath(tree, [])?.tag).toBe("div");
    expect(nodeAtPath(tree, [0])?.tag).toBe("h3");
    expect(nodeAtPath(tree, [5])).toBeNull();
  });

  it("updates a node without mutating the input", () => {
    const next = updateAtPath(tree, [0], (el) => ({ ...el, classes: "text-xl" }));
    expect(nodeAtPath(next, [0])?.classes).toBe("text-xl");
    expect(nodeAtPath(tree, [0])?.classes).toBe("text-lg");
  });

  it("appends a child and reports where it landed", () => {
    const { root: added, childPath } = appendChild(tree, [], {
      tag: "span",
      children: [{ text: "new" }],
    });
    expect(added.children).toHaveLength(3);
    // The returned path is what the UI selects after inserting.
    expect(childPath).toEqual([2]);
    expect(nodeAtPath(added, childPath)?.tag).toBe("span");

    const removed = removeAtPath(added, childPath);
    expect(removed.children).toHaveLength(2);
    expect(tree.children).toHaveLength(2); // original untouched
  });

  it("never removes the root", () => {
    expect(removeAtPath(tree, [])).toEqual(tree);
  });
});

describe("class groups", () => {
  it("reads the active class of a group and swaps within it", () => {
    const padding = CLASS_GROUPS.find((g) => g.options.includes("p-4"))!;
    expect(activeClassIn("rounded p-4", padding)).toBe("p-4");

    const swapped = setClassIn("rounded p-4", padding, padding.options[0]!);
    expect(swapped).toContain("rounded");
    expect(swapped).toContain(padding.options[0]!);
    expect(swapped.split(/\s+/).filter((c) => padding.options.includes(c))).toHaveLength(1);
  });

  it("removes a group's class when set to null", () => {
    const padding = CLASS_GROUPS.find((g) => g.options.includes("p-4"))!;
    expect(setClassIn("rounded p-4", padding, null)).toBe("rounded");
  });

  it("returns null when no class from the group is present", () => {
    const padding = CLASS_GROUPS.find((g) => g.options.includes("p-4"))!;
    expect(activeClassIn("rounded", padding)).toBeNull();
    expect(activeClassIn(undefined, padding)).toBeNull();
  });
});

describe("element snippets", () => {
  it("every snippet produces a template that survives a round trip", () => {
    expect(ELEMENT_SNIPPETS.length).toBeGreaterThan(0);
    for (const snippet of ELEMENT_SNIPPETS) {
      const el = snippet.make();
      const { template, problems } = htmlToTemplate(templateToHtml(el));
      expect(problems, `${snippet.label} reported problems`).toEqual([]);
      expect(template, `${snippet.label} failed to parse`).not.toBeNull();
    }
  });
});
