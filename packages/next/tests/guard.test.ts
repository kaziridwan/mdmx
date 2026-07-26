import { describe, expect, it } from "vitest";
import { getSession, privateHref } from "../src/index.js";
import { seal, SESSION_COOKIE } from "../src/session.js";

const SECRET = "test-secret-at-least-16-chars";

function sealedCookie(expiresAt: number): string {
  const sealed = seal(
    { login: "octocat", token: "tok", expiresAt, verifiedAt: Date.now() },
    SECRET,
  );
  return `${SESSION_COOKIE}=${sealed}`;
}

describe("getSession", () => {
  it("returns the synthetic local session in localMode", () => {
    const session = getSession(null, { localMode: true });
    expect(session?.login).toBe("local");
  });

  it("unseals a valid session cookie", () => {
    const header = `other=1; ${sealedCookie(Date.now() + 60_000)}`;
    const session = getSession(header, { sessionSecret: SECRET });
    expect(session?.login).toBe("octocat");
  });

  it("rejects a missing, expired, or tampered cookie", () => {
    expect(getSession(null, { sessionSecret: SECRET })).toBeNull();
    expect(getSession(sealedCookie(Date.now() - 1), { sessionSecret: SECRET })).toBeNull();
    expect(
      getSession(`${SESSION_COOKIE}=v1.not.a.session`, { sessionSecret: SECRET }),
    ).toBeNull();
    expect(
      getSession(sealedCookie(Date.now() + 60_000), { sessionSecret: "wrong-secret-16chars" }),
    ).toBeNull();
  });

  it("rejects everything without a secret outside localMode", () => {
    expect(getSession(sealedCookie(Date.now() + 60_000), {})).toBeNull();
  });
});

describe("privateHref", () => {
  it("builds /private/<collection>/<slug>", () => {
    expect(privateHref("posts", "welcome")).toBe("/private/posts/welcome");
    expect(privateHref("guides/api", "intro")).toBe("/private/guides/api/intro");
  });

  it("encodes unsafe segments", () => {
    expect(privateHref("posts", "a b")).toBe("/private/posts/a%20b");
  });
});
