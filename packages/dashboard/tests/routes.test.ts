import { describe, expect, it } from "vitest";
import { editorHref, resolveRoute, routeHref } from "../src/routes.js";

describe("resolveRoute", () => {
  it("maps the empty slug to home", () => {
    expect(resolveRoute([])).toEqual({ view: "home" });
  });

  it("maps collections/<name>", () => {
    expect(resolveRoute(["collections", "posts"])).toEqual({
      view: "collection",
      name: "posts",
    });
  });

  it("maps collections/new to collection creation", () => {
    expect(resolveRoute(["collections", "new"])).toEqual({ view: "collection-new" });
  });

  it("maps collections/<name>/edit to schema editing", () => {
    expect(resolveRoute(["collections", "posts", "edit"])).toEqual({
      view: "collection-edit",
      name: "posts",
    });
  });

  it("maps collections/<name>/new to entry scaffolding", () => {
    expect(resolveRoute(["collections", "posts", "new"])).toEqual({
      view: "entry-new",
      collection: "posts",
    });
  });

  it("maps bare /collections to home", () => {
    expect(resolveRoute(["collections"])).toEqual({ view: "home" });
  });

  it("maps edit/<path...> to the entry editor", () => {
    expect(resolveRoute(["edit", "posts", "welcome.mdx"])).toEqual({
      view: "editor",
      path: ["posts", "welcome.mdx"],
    });
  });

  it("maps media and settings", () => {
    expect(resolveRoute(["media"])).toEqual({ view: "media" });
    expect(resolveRoute(["settings"])).toEqual({ view: "settings" });
  });

  it("falls through to not-found for junk", () => {
    expect(resolveRoute(["nope"])).toEqual({ view: "not-found", slug: ["nope"] });
    expect(resolveRoute(["edit"])).toEqual({ view: "not-found", slug: ["edit"] });
    expect(resolveRoute(["media", "x"])).toEqual({
      view: "not-found",
      slug: ["media", "x"],
    });
    expect(resolveRoute(["collections", "posts", "edit", "x"])).toEqual({
      view: "not-found",
      slug: ["collections", "posts", "edit", "x"],
    });
  });
});

describe("hrefs", () => {
  it("builds route hrefs under the mount path", () => {
    expect(routeHref("/mdmx", "collections", "posts")).toBe("/mdmx/collections/posts");
    expect(routeHref("/mdmx")).toBe("/mdmx");
  });

  it("escapes segments", () => {
    expect(routeHref("/mdmx", "collections", "a b")).toBe("/mdmx/collections/a%20b");
  });

  it("builds editor hrefs from content paths", () => {
    expect(editorHref("/mdmx", "posts/welcome.mdx")).toBe(
      "/mdmx/edit/posts/welcome.mdx",
    );
  });
});
