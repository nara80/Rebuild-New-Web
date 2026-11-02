const SESSION_COOKIE_RE = /^__session(?:_[A-Za-z0-9_-]{1,64})?$/;
const DEV_SESSION_COOKIE_RE = /^__clerk_db_jwt(?:_[A-Za-z0-9_-]{1,64})?$/;

type TokenCandidate = {
  name: string;
  value: string;
  source: "cookie" | "query";
};

export type ClerkSessionTokenResult = {
  token: string | null;
  source: "cookie" | "query" | null;
  ambiguous: boolean;
};

function isSessionTokenName(name: string): boolean {
  return SESSION_COOKIE_RE.test(name) || DEV_SESSION_COOKIE_RE.test(name);
}

function parseCookieHeader(cookieHeader: string): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) return { name: "", value: "" };
      return {
        name: part.slice(0, idx).trim(),
        value: part.slice(idx + 1).trim(),
      };
    })
    .filter((entry) => entry.name && entry.value);
}

function collectCookieCandidates(request: Request): TokenCandidate[] {
  const cookieHeader = request.headers.get("Cookie") || "";
  const parsed = parseCookieHeader(cookieHeader);
  return parsed
    .filter((entry) => isSessionTokenName(entry.name))
    .map((entry) => ({ name: entry.name, value: entry.value, source: "cookie" as const }));
}

function collectQueryCandidates(request: Request): TokenCandidate[] {
  const url = new URL(request.url);
  const out: TokenCandidate[] = [];
  for (const [name, value] of url.searchParams.entries()) {
    if (!value) continue;
    if (!isSessionTokenName(name)) continue;
    out.push({ name, value: value.trim(), source: "query" });
  }
  return out;
}

export function extractClerkSessionToken(
  request: Request,
  options: { allowQueryToken?: boolean } = {}
): ClerkSessionTokenResult {
  const cookieCandidates = collectCookieCandidates(request);
  const queryCandidates = options.allowQueryToken ? collectQueryCandidates(request) : [];
  const all = [...cookieCandidates, ...queryCandidates];

  if (!all.length) {
    return { token: null, source: null, ambiguous: false };
  }

  const uniqueValues = Array.from(new Set(all.map((candidate) => candidate.value)));
  if (uniqueValues.length !== 1) {
    return { token: null, source: null, ambiguous: true };
  }

  const token = uniqueValues[0];
  const source = all.some((candidate) => candidate.source === "cookie") ? "cookie" : "query";
  return { token, source, ambiguous: false };
}
