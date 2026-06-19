import { describe, expect, it } from "vitest";
import { validateSource } from "../src/index.js";
import { testRegistry } from "./registry.fixture.js";

const validate = (source: string) =>
  validateSource(source, { registry: testRegistry });

const codes = (source: string) => validate(source).map((d) => d.code);

describe("subset enforcement (IMDX003)", () => {
  it("accepts a fully valid document", () => {
    const diags = validate(
      [
        "# Title",
        "",
        '<Callout variant="info">',
        "  Some **rich** text.",
        "</Callout>",
        "",
        '<Chart series={["a"]} />',
        "",
      ].join("\n"),
    );
    expect(diags).toEqual([]);
  });

  it("rejects import/export statements", () => {
    expect(codes('import { x } from "y"\n\n# Hi\n')).toContain("IMDX003");
  });

  it("rejects flow expressions", () => {
    expect(codes("{new Date().getFullYear()}\n")).toContain("IMDX003");
  });

  it("rejects inline text expressions", () => {
    expect(codes("The year is {2026}.\n")).toContain("IMDX003");
  });

  it("rejects inline (text-level) components", () => {
    expect(codes('Hello <Callout variant="info">x</Callout> world\n')).toContain(
      "IMDX003",
    );
  });

  it("rejects JSX fragments", () => {
    expect(codes("<>\n  hi\n</>\n")).toContain("IMDX003");
  });
});

describe("registry membership (IMDX001)", () => {
  it("rejects unknown components", () => {
    expect(codes("<Mystery />\n")).toEqual(["IMDX001"]);
  });
});

describe("prop serializability (IMDX002)", () => {
  it("rejects identifier props", () => {
    expect(codes("<Chart series={someVar} />\n")).toContain("IMDX002");
  });

  it("rejects call expressions", () => {
    expect(codes("<Chart series={getSeries()} />\n")).toContain("IMDX002");
  });

  it("rejects template literals", () => {
    expect(codes("<Chart series={[`q${1}`]} />\n")).toContain("IMDX002");
  });

  it("rejects spread attributes", () => {
    expect(codes('<Chart {...rest} series={["a"]} />\n')).toContain("IMDX002");
  });
});

describe("children policy (IMDX004)", () => {
  it("rejects children on a children:none component", () => {
    expect(codes('<Chart series={["a"]}>\n  hi\n</Chart>\n')).toContain("IMDX004");
  });

  it("rejects block content inside rich-text children", () => {
    expect(
      codes('<Callout variant="info">\n  ## A heading\n</Callout>\n'),
    ).toContain("IMDX004");
  });

  it("rejects nested components inside rich-text children", () => {
    expect(
      codes(
        '<Callout variant="info">\n  <Chart series={["a"]} />\n</Callout>\n',
      ),
    ).toContain("IMDX004");
  });

  it("enforces allowedChildren slots", () => {
    expect(codes("<TwoColumn>\n  just a paragraph\n</TwoColumn>\n")).toContain(
      "IMDX004",
    );
  });

  it("accepts the valid slot arrangement", () => {
    const diags = validate(
      [
        "<TwoColumn>",
        "  <Column>",
        "    ## Left",
        "  </Column>",
        "",
        "  <Column>",
        "    Right text.",
        "  </Column>",
        "</TwoColumn>",
        "",
      ].join("\n"),
    );
    expect(diags).toEqual([]);
  });
});

describe("parent constraints (IMDX005)", () => {
  it("rejects a slot child outside its parent", () => {
    expect(codes("<Column>\n  hi\n</Column>\n")).toContain("IMDX005");
  });
});

describe("prop schema (IMDX006 / IMDX007)", () => {
  it("flags a missing required prop without a default", () => {
    expect(codes("<Chart />\n")).toContain("IMDX006");
  });

  it("does not flag a missing required prop that has a default", () => {
    // Callout.variant is required but has default "info"
    expect(codes("<Callout>\n  hi\n</Callout>\n")).toEqual([]);
  });

  it("warns on undeclared props", () => {
    const diags = validate('<Chart series={["a"]} bogus="x" />\n');
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("IMDX007");
    expect(diags[0]!.severity).toBe("warning");
  });
});

describe("diagnostics carry source spans", () => {
  it("points at the offending node", () => {
    const diags = validate("# ok\n\n<Mystery />\n");
    expect(diags).toHaveLength(1);
    expect(diags[0]!.span?.start.line).toBe(3);
  });
});
