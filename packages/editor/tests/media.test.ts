import { describe, expect, it } from "vitest";
import { Registry, type RegistrySpec } from "@imdx/core";
import { buildSchema } from "../src/schema.js";
import { serializeDoc } from "../src/react/source-map.js";
import {
  bytesToBase64,
  fileToUpload,
  isImagePath,
  mediaPath,
  safeFilename,
} from "../src/react/media.js";

const EMPTY: RegistrySpec = { imdxRegistryVersion: 1, components: [] };

describe("safeFilename", () => {
  it("strips directories, lowercases, and hyphenates unsafe runs", () => {
    expect(safeFilename("My Photo (1).PNG")).toBe("my-photo-1.png");
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("a/b/c/Logo@2x.webp")).toBe("logo-2x.webp");
    expect(safeFilename(".gitkeep")).toBe("gitkeep");
    expect(safeFilename("???")).toBe("file");
  });
});

describe("mediaPath", () => {
  it("joins a media dir and sanitized name, trimming trailing slashes", () => {
    expect(mediaPath("public/media", "Hero Shot.jpg")).toBe("public/media/hero-shot.jpg");
    expect(mediaPath("public/media/", "x.png")).toBe("public/media/x.png");
  });
});

describe("isImagePath", () => {
  it("recognizes image extensions only", () => {
    expect(isImagePath("a/b/logo.png")).toBe(true);
    expect(isImagePath("doc.PDF")).toBe(false);
    expect(isImagePath("noext")).toBe(false);
  });
});

describe("bytesToBase64 / fileToUpload", () => {
  it("base64-encodes bytes without a data-URL prefix", () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe("aGk="); // "hi"
  });

  it("turns a File-like into an upload payload under the media dir", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const file = {
      name: "Cover Image.PNG",
      arrayBuffer: async () => bytes.buffer,
    };
    const upload = await fileToUpload(file, "public/media");
    expect(upload.path).toBe("public/media/cover-image.png");
    expect(upload.dataBase64).toBe(bytesToBase64(bytes));
  });
});

describe("image node serialization", () => {
  it("serializes an image node back to canonical markdown", () => {
    const registry = new Registry(EMPTY);
    const schema = buildSchema(registry);
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.node("image", { src: "/media/logo.png", alt: "Logo", title: null }),
      ]),
    ]);
    expect(serializeDoc(doc, registry).trim()).toBe("![Logo](/media/logo.png)");
  });
});
