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
    expect(account).toEqual({
      token: "token123",
      source: "cookie",
      ambiguous: false,
      candidates: ["token123"],
      candidatesComplete: true,
      candidateCookieNames: ["__session_abc"],
    });

    const admin = extractClerkSessionToken(
      req("/super-admin/", "__clerk_db_jwt_xyz=devtoken; theme=dark")
    );
    expect(admin).toEqual({
      token: "devtoken",
      source: "cookie",
      ambiguous: false,
      candidates: ["devtoken"],
      candidatesComplete: true,
      candidateCookieNames: ["__clerk_db_jwt_xyz"],
    });
  });

  it("reports conflicting cookie tokens as ambiguous with bounded candidates", () => {
    const parsed = extractClerkSessionToken(
      req("/super-admin/", "__session_a=tokenA; __session_b=tokenB")
    );
    expect(parsed.token).toBeNull();
    expect(parsed.ambiguous).toBe(true);
    // Distinct values are surfaced (bounded) so the caller can verify each
    // with the strict JWT pipeline instead of rejecting blindly.
    expect(new Set(parsed.candidates)).toEqual(new Set(["tokenA", "tokenB"]));
    expect(parsed.candidatesComplete).toBe(true);
  });

  it("rejects conflicting __session and __clerk_db_jwt values (ambiguous, candidates listed)", () => {
    const parsed = extractClerkSessionToken(
      req("/account/", "__session=prodToken; __clerk_db_jwt=devToken")
    );
    expect(parsed.token).toBeNull();
    expect(parsed.ambiguous).toBe(true);
    expect(new Set(parsed.candidates)).toEqual(new Set(["prodToken", "devToken"]));
    expect(parsed.candidatesComplete).toBe(true);
  });

  it("ignores token-bearing query params when not explicitly enabled", () => {
    const parsed = extractClerkSessionToken(
      req("/super-admin/?__session=queryToken")
    );
    expect(parsed).toEqual({
      token: null,
      source: null,
      ambiguous: false,
      candidates: [],
      candidatesComplete: true,
      candidateCookieNames: [],
    });
  });

  it("allows token-bearing query params for callback flow only when enabled", () => {
    const callback = extractClerkSessionToken(
      req("/auth/clerk-return/?next=%2Fsuper-admin%2F&__clerk_db_jwt=queryToken"),
      { allowQueryToken: true }
    );
    expect(callback).toEqual({
      token: "queryToken",
      source: "query",
      ambiguous: false,
      candidates: ["queryToken"],
      candidatesComplete: true,
      candidateCookieNames: [],
    });
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
    expect(new Set(parsed.candidates)).toEqual(new Set(["queryToken", "cookieToken"]));
    expect(parsed.candidatesComplete).toBe(true);
  });

  it("marks candidate list truncated beyond the examination cap", () => {
    // 9 distinct session-token values â€” over the bounded cap (8).
    const cookies = Array.from({ length: 9 }, (_, i) => `__session_s${i}=tok${i}`).join("; ");
    const parsed = extractClerkSessionToken(req("/account/", cookies));
    expect(parsed.ambiguous).toBe(true);
    expect(parsed.candidatesComplete).toBe(false);
    expect(parsed.candidates.length).toBe(8);
  });
});
