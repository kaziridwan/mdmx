import { describe, expect, it } from "vitest";
import { Registry, type RegistrySpec } from "@mdmx/core";
import { buildSchema } from "../src/schema.js";
import { serializeDoc } from "../src/react/source-map.js";
import {
  bytesToBase64,
  fileToUpload,
  imageFromClipboard,
  isImagePath,
  mediaPath,
  pastedImageUpload,
  pastedMediaPath,
  safeFilename,
  timestampedMediaName,
} from "../src/react/media.js";

const EMPTY: RegistrySpec = { mdmxRegistryVersion: 1, components: [] };

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

describe("timestampedMediaName", () => {
  it("derives a sortable, filesystem-safe name from MIME + time", () => {
    const at = new Date("2026-06-21T12:34:56.789Z");
    expect(timestampedMediaName("image/png", at)).toBe("pasted-2026-06-21t12-34-56-789z.png");
    expect(timestampedMediaName("image/jpeg", at)).toBe("pasted-2026-06-21t12-34-56-789z.jpg");
    expect(timestampedMediaName("image/svg+xml", at)).toBe("pasted-2026-06-21t12-34-56-789z.svg");
  });

  it("falls back to png for unknown MIME types", () => {
    const at = new Date("2026-06-21T00:00:00.000Z");
    expect(timestampedMediaName("application/octet-stream", at)).toBe(
      "pasted-2026-06-21t00-00-00-000z.png",
    );
  });
});

describe("pastedMediaPath", () => {
  const at = new Date("2026-06-21T12:34:56.789Z");

  it("nests pasted images under a directory named after the collection", () => {
    expect(pastedMediaPath("public/media", "image/png", "posts", at)).toBe(
      "public/media/posts/pasted-2026-06-21t12-34-56-789z.png",
    );
  });

  it("sanitizes the collection segment and trims the media dir", () => {
    expect(pastedMediaPath("public/media/", "image/gif", "Blog Posts!", at)).toBe(
      "public/media/blog-posts/pasted-2026-06-21t12-34-56-789z.gif",
    );
  });

  it("drops to the media dir root when no collection is known", () => {
    expect(pastedMediaPath("public/media", "image/webp", undefined, at)).toBe(
      "public/media/pasted-2026-06-21t12-34-56-789z.webp",
    );
  });
});

describe("imageFromClipboard", () => {
  const pngFile = { type: "image/png", name: "x" } as unknown as File;
  const textFile = { type: "text/plain", name: "n" } as unknown as File;

  it("returns the first image file from clipboard files", () => {
    const dt = { files: [textFile, pngFile], items: [] } as unknown as DataTransfer;
    expect(imageFromClipboard(dt)).toBe(pngFile);
  });

  it("falls back to file items when files is empty", () => {
    const dt = {
      files: [],
      items: [{ kind: "file", type: "image/png", getAsFile: () => pngFile }],
    } as unknown as DataTransfer;
    expect(imageFromClipboard(dt)).toBe(pngFile);
  });

  it("returns null when no image is present", () => {
    const dt = {
      files: [textFile],
      items: [{ kind: "string", type: "text/plain", getAsFile: () => null }],
    } as unknown as DataTransfer;
    expect(imageFromClipboard(dt)).toBeNull();
  });
});

describe("pastedImageUpload", () => {
  it("builds a collection-scoped, timestamped upload payload", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const file = {
      type: "image/png",
      arrayBuffer: async () => bytes.buffer,
    } as unknown as File;
    const upload = await pastedImageUpload(file, "public/media", "posts");
    expect(upload.path).toMatch(/^public\/media\/posts\/pasted-.*\.png$/);
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
