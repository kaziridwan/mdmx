import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";

/**
 * The published surface, asserted as a list.
 *
 * Package tests import from `src/` paths, so barrel breakage used to ship
 * silently (review §3.4). After the 0.5 prune the barrel *is* the contract:
 * this test fails loudly both when something disappears and when something
 * new is exported without a deliberate decision.
 */
const PUBLIC_API = [
  "AuthError",
  "GitHubOAuthStrategy",
  "LocalAuthStrategy",
  "LocalProvider",
  "createMDMXHandlers",
  "getEntries",
  "getEntryBySlug",
  "getSession",
  "getStudioComponentDefs",
  "privateHref",
].sort();

describe("@mdmx/next public API", () => {
  it("exports exactly the supported surface", () => {
    expect(Object.keys(api).sort()).toEqual(PUBLIC_API);
  });

  it("no longer publishes session crypto or cookie helpers", () => {
    for (const internal of ["seal", "unseal", "serializeCookie", "clearCookie", "parseCookies"]) {
      expect(api).not.toHaveProperty(internal);
    }
  });
});
