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
  // Distinct session-token values observed (bounded by MAX_SESSION_CANDIDATES).
  // Populated even for the single-candidate case so callers can verify each
  // candidate cryptographically instead of rejecting on ambiguity alone.
  candidates: string[];
  // false when more distinct values were seen than MAX_SESSION_CANDIDATES —
  // callers must reject rather than partially examine.
  candidatesComplete: boolean;
};

// Upper bound on distinct session-token candidates examined per request.
// Real-world conflicts come from duplicate host/domain-scoped cookies (2-3
// entries); 8 leaves generous headroom while bounding verification work.
const MAX_SESSION_CANDIDATES = 8;

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
    return { token: null, source: null, ambiguous: false, candidates: [], candidatesComplete: true };
  }

  const uniqueValues = Array.from(new Set(all.map((candidate) => candidate.value)));
  if (uniqueValues.length !== 1) {
    // Conflicting credentials: never choose by cookie order, role, or
    // allowlist. Hand every distinct value to the caller so each can be
    // verified with the strict JWT pipeline; the caller accepts exactly one
    // valid candidate or rejects.
    return {
      token: null,
      source: null,
      ambiguous: true,
      candidates: uniqueValues.slice(0, MAX_SESSION_CANDIDATES),
      candidatesComplete: uniqueValues.length <= MAX_SESSION_CANDIDATES,
    };
  }

  const token = uniqueValues[0];
  const source = all.some((candidate) => candidate.source === "cookie") ? "cookie" : "query";
  return { token, source, ambiguous: false, candidates: [token], candidatesComplete: true };
}
