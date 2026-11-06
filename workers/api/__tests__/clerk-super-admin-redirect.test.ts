import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const clerkJs = fs.readFileSync(
  path.resolve(process.cwd(), "public/js/clerk.js"),
  "utf8"
);

describe("super-admin Clerk redirect handoff", () => {
  it("forces sign-in/sign-up return URLs to requested super-admin callback", () => {
    expect(clerkJs).toContain("function buildHostedAuthUrl(path, redirectUrl)");
    expect(clerkJs).toContain("sign_in_force_redirect_url");
    expect(clerkJs).toContain("sign_in_fallback_redirect_url");
    expect(clerkJs).toContain("sign_up_force_redirect_url");
    expect(clerkJs).toContain("sign_up_fallback_redirect_url");
    expect(clerkJs).toContain("clerkInstance.redirectToSignIn(buildForceRedirectOptions(redirectUrl))");
    expect(clerkJs).toContain("clerkInstance.redirectToSignUp(buildForceRedirectOptions(redirectUrl))");
  });

  it("keeps super-admin callback wrapping via /auth/clerk-return/", () => {
    expect(clerkJs).toContain("if (path.indexOf('/super-admin') !== 0) return cleanUrl;");
    expect(clerkJs).toContain("if (url.origin !== current.origin)");
    expect(clerkJs).toContain("url = current;");
    expect(clerkJs).toContain("var callbackUrl = new URL('/auth/clerk-return/', url.origin);");
    expect(clerkJs).toContain("callbackUrl.searchParams.set('next', url.pathname + (url.search || ''));");
    expect(clerkJs).toContain("return callbackUrl.toString();");
  });
});
