import { describe, expect, it } from "vitest";
import type { PropSpec } from "@imdx/core";
import {
  coerceControlValue,
  displayControlValue,
  setPropValue,
} from "../src/react/prop-controls.js";

describe("coerceControlValue", () => {
  it("coerces numbers, dropping blank/NaN", () => {
    expect(coerceControlValue({ type: "number" }, "42")).toBe(42);
    expect(coerceControlValue({ type: "number" }, "-3.5")).toBe(-3.5);
    expect(coerceControlValue({ type: "number" }, "")).toBeUndefined();
    expect(coerceControlValue({ type: "number" }, "nope")).toBeUndefined();
  });

  it("coerces booleans", () => {
    expect(coerceControlValue({ type: "boolean" }, "true")).toBe(true);
    expect(coerceControlValue({ type: "boolean" }, "false")).toBe(false);
  });

  it("parses json, dropping invalid", () => {
    expect(coerceControlValue({ type: "json" }, '{"a":1}')).toEqual({ a: 1 });
    expect(coerceControlValue({ type: "json" }, "not json")).toBeUndefined();
    expect(coerceControlValue({ type: "json" }, "")).toBeUndefined();
  });

  it("splits multiselect on commas", () => {
    expect(coerceControlValue({ type: "multiselect", options: [] }, "a, b ,c")).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(coerceControlValue({ type: "multiselect", options: [] }, "")).toBeUndefined();
  });

  it("treats empty text/select as undefined", () => {
    expect(coerceControlValue({ type: "text" }, "")).toBeUndefined();
    expect(coerceControlValue({ type: "text" }, "hi")).toBe("hi");
    expect(coerceControlValue({ type: "select", options: ["a"] }, "")).toBeUndefined();
  });
});

describe("displayControlValue", () => {
  it("stringifies scalars and serializes structures", () => {
    expect(displayControlValue(undefined)).toBe("");
    expect(displayControlValue(null)).toBe("");
    expect(displayControlValue(42)).toBe("42");
    expect(displayControlValue(true)).toBe("true");
    expect(displayControlValue("x")).toBe("x");
    expect(displayControlValue(["a", "b"])).toBe('["a","b"]');
  });
});

describe("setPropValue", () => {
  const spec: PropSpec = { name: "title", required: false, control: { type: "text" } };

  it("drops keys whose value coerces to undefined", () => {
    expect(setPropValue({ title: "x" }, spec, "")).toEqual({});
  });

  it("sets values without mutating the input", () => {
    const original = { variant: "info" };
    const next = setPropValue(original, spec, "Heads up");
    expect(next).toEqual({ variant: "info", title: "Heads up" });
    expect(original).toEqual({ variant: "info" });
  });
});
