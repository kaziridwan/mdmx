import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../src/sanitize-html.js";

describe("sanitizeHtml", () => {
  it("removes <script> elements and their content", () => {
    const out = sanitizeHtml('<div>hi</div><script>alert(1)</script>');
    expect(out).toBe("<div>hi</div>");
    expect(out).not.toContain("alert");
  });

  it("removes unclosed/self-closing script tags", () => {
    expect(sanitizeHtml('<script src="x.js">')).toBe("");
    expect(sanitizeHtml('a<script/>b')).toBe("ab");
  });

  it("strips on* event-handler attributes (all quoting styles)", () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
    expect(sanitizeHtml("<a onclick='go()'>x</a>")).toBe("<a>x</a>");
    expect(sanitizeHtml("<b onmouseover=hack()>x</b>")).toBe("<b>x</b>");
  });

  it("neutralizes javascript: URLs in href/src", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml("<a href='javascript:x'>y</a>")).toBe("<a href='#'>y</a>");
    expect(sanitizeHtml('<img src=javascript:evil>')).toContain('src="#"');
  });

  it("removes iframe/object/embed elements", () => {
    expect(sanitizeHtml('<iframe src="evil"></iframe>')).toBe("");
    expect(sanitizeHtml('before<object data="x"></object>after')).toBe("beforeafter");
  });

  it("removes document-affecting void tags", () => {
    expect(sanitizeHtml('<meta http-equiv="refresh" content="0;url=evil"><p>ok</p>')).toBe("<p>ok</p>");
  });

  it("leaves safe markup untouched", () => {
    const safe = '<div class="card"><h2>Title</h2><p>Body with <a href="https://example.com">a link</a>.</p></div>';
    expect(sanitizeHtml(safe)).toBe(safe);
  });
});
