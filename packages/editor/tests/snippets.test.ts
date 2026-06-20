// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { listSnippets, saveSnippet, deleteSnippet } from "../src/snippets.js";

beforeEach(() => localStorage.clear());

describe("snippet store", () => {
  it("starts empty", () => {
    expect(listSnippets()).toEqual([]);
  });

  it("saves and lists snippets (newest first)", () => {
    saveSnippet("Card", "<div>card</div>");
    saveSnippet("Banner", "<div>banner</div>");
    expect(listSnippets().map((s) => s.name)).toEqual(["Banner", "Card"]);
  });

  it("upserts by name and trims the name", () => {
    saveSnippet("Card", "<div>v1</div>");
    saveSnippet("  Card  ", "<div>v2</div>");
    const all = listSnippets();
    expect(all).toHaveLength(1);
    expect(all[0]!.html).toBe("<div>v2</div>");
  });

  it("ignores empty name or html", () => {
    saveSnippet("", "<div>x</div>");
    saveSnippet("Empty", "   ");
    expect(listSnippets()).toEqual([]);
  });

  it("deletes by name", () => {
    saveSnippet("A", "<i>a</i>");
    saveSnippet("B", "<i>b</i>");
    deleteSnippet("A");
    expect(listSnippets().map((s) => s.name)).toEqual(["B"]);
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("imdx:snippets", "not json");
    expect(listSnippets()).toEqual([]);
  });
});
