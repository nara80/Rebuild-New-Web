// Phase 16 preview blocker — Clerk DEVELOPMENT sign-in loop regression guard.
//
// Root cause (2026-11-07): the preview signs in through the Clerk
// Development instance, which returns the cross-origin session as
// `__clerk_db_jwt` (the dev-browser token). The callback route only knew how
// to consume the PRODUCTION `__clerk_handshake` payload, so the dev token was
// stripped without being consumed and the callback bounced the browser back
// to the hosted sign-in page — the recurring sign-in loop.
//
// Contract locked by this suite:
//   - preview/local hosts: the dev handshake is FORWARDED to the destination
//     page (public/js/clerk.js finishes it via the Clerk SDK);
//   - preview/local hosts without a handshake: unchanged sign-in redirect;
//   - production hosts: completely unchanged (no dev-handshake handling).

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function findFileAbove(relative: string): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`${relative} not found above test dir`);
}

type Handler = (context: any) => Promise<Response>;

let clerkReturn: Handler;

const PREVIEW_ORIGIN = "https://phase16-ai-analyst.mildmate-new.pages.dev";
const PROD_ORIGIN = "https://www.mildmate.com";

const DEV_ENV = { CLERK_ACCOUNTS_DOMAIN: "kind-joey-29.accounts.dev" };
const PROD_ENV = {
  CLERK_ACCOUNTS_DOMAIN: "accounts.mildmate.com",
  CLERK_ISSUER: "https://clerk.mildmate.com",
  CLERK_JWKS_URL: "https://clerk.mildmate.com/.well-known/jwks.json",
};

async function call(url: string, env: any): Promise<Response> {
  const request = new Request(url);
  return clerkReturn({ request, env, next: async () => new Response("NEXT", { status: 200 }) });
}

function locationOf(resp: Response): URL {
  return new URL(resp.headers.get("Location") || "");
}

describe("Clerk development handshake — preview callback", () => {
  it("forwards the dev handshake to the destination page instead of looping to sign-in", async () => {
    const resp = await call(
      `${PREVIEW_ORIGIN}/auth/clerk-return/?next=%2Fsuper-admin%2Fmarketing%2F&__clerk_db_jwt=dev-token`,
      DEV_ENV
    );
    expect(resp.status).toBe(302);
    const loc = locationOf(resp);
    // NOT the hosted sign-in portal — that was the loop.
    expect(loc.hostname).not.toBe("kind-joey-29.accounts.dev");
    expect(loc.origin).toBe(PREVIEW_ORIGIN);
    expect(loc.pathname).toBe("/super-admin/marketing/");
    // The token is handed to the Clerk SDK on the destination page.
    expect(loc.searchParams.get("__clerk_db_jwt")).toBe("dev-token");
  });

  it("preserves a suffixed Clerk dev-handshake parameter name", async () => {
    const resp = await call(
      `${PREVIEW_ORIGIN}/auth/clerk-return/?next=%2Fsuper-admin%2F&__clerk_db_jwt_abc123=dev-token`,
      DEV_ENV
    );
    expect(resp.status).toBe(302);
    const loc = locationOf(resp);
    expect(loc.hostname).not.toBe("kind-joey-29.accounts.dev");
    expect(loc.pathname).toBe("/super-admin/");
    expect(loc.searchParams.get("__clerk_db_jwt_abc123")).toBe("dev-token");
  });

  it("keeps the next-path query string and never leaves the request origin", async () => {
    const resp = await call(
      `${PREVIEW_ORIGIN}/auth/clerk-return/?next=%2Fsuper-admin%2Fmarketing%2F%3Ftab%3Dai&__clerk_db_jwt=dev-token`,
      DEV_ENV
    );
    expect(resp.status).toBe(302);
    const loc = locationOf(resp);
    expect(loc.pathname).toBe("/super-admin/marketing/");
    expect(loc.searchParams.get("tab")).toBe("ai");
    expect(loc.searchParams.get("__clerk_db_jwt")).toBe("dev-token");
  });

  it("rejects an off-site next path (no open redirect) while still forwarding the dev handshake", async () => {
    const resp = await call(
      `${PREVIEW_ORIGIN}/auth/clerk-return/?next=https%3A%2F%2Fevil.example%2Fsteal&__clerk_db_jwt=dev-token`,
      DEV_ENV
    );
    expect(resp.status).toBe(302);
    const loc = locationOf(resp);
    expect(loc.origin).toBe(PREVIEW_ORIGIN);
    expect(loc.pathname).toBe("/super-admin/");
    expect(loc.searchParams.get("__clerk_db_jwt")).toBe("dev-token");
  });

  it("keeps the existing preview sign-in redirect when no session and no handshake are present", async () => {
    const resp = await call(`${PREVIEW_ORIGIN}/auth/clerk-return/?next=%2Fsuper-admin%2F`, DEV_ENV);
    expect(resp.status).toBe(302);
    const loc = locationOf(resp);
    expect(loc.hostname).toBe("kind-joey-29.accounts.dev");
    expect(loc.pathname).toBe("/sign-in");
    expect(loc.searchParams.get("redirect_url")).toBe(
      `${PREVIEW_ORIGIN}/auth/clerk-return/?next=%2Fsuper-admin%2F`
    );
  });

  it("leaves the production callback untouched (no dev-handshake handling)", async () => {
    const resp = await call(
      `${PROD_ORIGIN}/auth/clerk-return/?next=%2Fsuper-admin%2F&__clerk_db_jwt=dev-token`,
      PROD_ENV
    );
    expect(resp.status).toBe(302);
    const loc = locationOf(resp);
    // Production still uses the production hosted portal; the dev token is
    // never forwarded to an application page.
    expect(loc.hostname).toBe("accounts.mildmate.com");
    expect(loc.pathname).toBe("/sign-in");
    expect(loc.searchParams.get("redirect_url")).toContain(`${PROD_ORIGIN}/auth/clerk-return/`);
  });
});

beforeAll(async () => {
  ({ onRequest: clerkReturn } = await import(
    pathToFileURL(findFileAbove(join("functions", "auth", "clerk-return", "[[path]].ts"))).href
  ));
});
