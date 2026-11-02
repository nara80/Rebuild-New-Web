import { describe, expect, it } from "vitest";
import { extractClerkSessionToken } from "../clerk-session-token";

function req(path: string, cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  return new Request(`https://www.mildmate.com${path}`, { headers });
}

describe("clerk session token extraction", () => {
  it("accepts suffix-based session cookies for account and admin routes", () => {
    const account = extractClerkSessionToken(
      req("/account/", "__session_abc=token123; other=value")
    );
    expect(account).toEqual({ token: "token123", source: "cookie", ambiguous: false });

    const admin = extractClerkSessionToken(
      req("/super-admin/", "__clerk_db_jwt_xyz=devtoken; theme=dark")
    );
    expect(admin).toEqual({ token: "devtoken", source: "cookie", ambiguous: false });
  });

  it("rejects ambiguous conflicting cookie tokens", () => {
    const parsed = extractClerkSessionToken(
      req("/super-admin/", "__session_a=tokenA; __session_b=tokenB")
    );
    expect(parsed.token).toBeNull();
    expect(parsed.ambiguous).toBe(true);
  });

  it("rejects conflicting __session and __clerk_db_jwt values", () => {
    const parsed = extractClerkSessionToken(
      req("/account/", "__session=prodToken; __clerk_db_jwt=devToken")
    );
    expect(parsed.token).toBeNull();
    expect(parsed.ambiguous).toBe(true);
  });

  it("ignores token-bearing query params when not explicitly enabled", () => {
    const parsed = extractClerkSessionToken(
      req("/super-admin/?__session=queryToken")
    );
    expect(parsed).toEqual({ token: null, source: null, ambiguous: false });
  });

  it("allows token-bearing query params for callback flow only when enabled", () => {
    const callback = extractClerkSessionToken(
      req("/auth/clerk-return/?next=%2Fsuper-admin%2F&__clerk_db_jwt=queryToken"),
      { allowQueryToken: true }
    );
    expect(callback).toEqual({ token: "queryToken", source: "query", ambiguous: false });
  });

  it("rejects callback flow when cookie and query tokens conflict", () => {
    const parsed = extractClerkSessionToken(
      req(
        "/auth/clerk-return/?next=%2Fsuper-admin%2F&__session=queryToken",
        "__session_suffix=cookieToken"
      ),
      { allowQueryToken: true }
    );
    expect(parsed.token).toBeNull();
    expect(parsed.ambiguous).toBe(true);
  });
});
