import { describe, expect, it } from "vitest";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import {
  evaluateAttributes,
  parseDocument,
  Registry,
  validateSource,
} from "../src/index.js";

function firstElement(source: string): MdxJsxFlowElement {
  const { tree } = parseDocument(source);
  const el = tree.children.find((n) => n.type === "mdxJsxFlowElement");
  if (!el) throw new Error("no JSX element in source");
  return el as MdxJsxFlowElement;
}

describe("prototype-key safety", () => {
  it('an attribute named "__proto__" becomes an own property, not a prototype rebind', () => {
    const el = firstElement('<Chart __proto__={{ "polluted": true }} series={["a"]} />\n');
    const { props } = evaluateAttributes(el);
    expect(Object.hasOwn(props, "__proto__")).toBe(true);
    expect(props["__proto__"]).toEqual({ polluted: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('an object key named "__proto__" stays an own key of the value', () => {
    const el = firstElement('<Chart config={{ "__proto__": { "polluted": true } }} series={["a"]} />\n');
    const { props } = evaluateAttributes(el);
    const config = props.config as Record<string, unknown>;
    expect(Object.hasOwn(config, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('a required prop named "toString" is reported when missing (MDMX006)', () => {
    const registry = new Registry({
      mdmxRegistryVersion: 1,
      components: [
        {
          name: "Widget",
          children: { policy: "none" },
          props: [{ name: "toString", required: true, control: { type: "text" } }],
        },
      ],
    });
    const codes = validateSource("<Widget />\n", { registry }).map((d) => d.code);
    expect(codes).toContain("MDMX006");
  });
});
