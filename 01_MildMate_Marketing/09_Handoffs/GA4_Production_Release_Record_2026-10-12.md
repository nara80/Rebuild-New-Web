# GA4 Production Release Record — 2026-10-12

## Release Summary

MildMate GA4 Consent Mode v2 architecture released to production (www.mildmate.com).

| Item | Value |
|---|---|
| Website deployment | Cloudflare Pages deployment `4cf77748` (project `mildmate-new`, branch `master`) |
| Commit deployed | `efbde46` — `fix(consent): bridge fails closed on duplicate mm-consent cookies` |
| Bundle | `public/_worker.js` SHA-256 `BCE8B2DB…` (byte-identical to audited release artifact, `--no-bundle` deploy) |
| GTM container | GTM-KLJZZM9, live **version 17** ("MildMate GA4 Consent Mode v2 - Production Release") |
| GTM rollback target | Version 16 |
| Website rollback target | Pages deployment `224ca19e-1a2a-499b-bd09-02501bd904d5` (prior production) |

## Release Contents

- GA4 production property `G-0GWVSPJLVJ` via GTM-KLJZZM9 (Consent Mode v2: bridge owns default + update).
- Google Ads conversion tag AW-18373693725 (label `ODYACIyL8pMdEJ2ioblE`), orderId dedup via `{{DLV - Transaction ID}}`.
- Consent Bridge fails closed on duplicate/malformed `mm-consent` cookies (`savedValues.length === 1`) — includes regression tests T1–T5 (5/5 PASS in GTM).
- CSP-safe `MildMate Consent Signal` variable template (duplicate cookies → denied).
- Permanent Cookie Settings re-entry point (footer/fixed fallback).
- Legacy GA4 `G-ESL161CNBV` bootstrap removed; legacy Universal Analytics and marketplace tags paused.

## Verification (live, 2026-10-12 — 20/20 PASS)

1. **Default-denied:** zero GTM/GA4/Ads network requests on first visit (homepage + product page).
2. **Opt-in:** Accept All → `mm-consent` cookie written, deferred GTM load, GA4 page_view to `g/collect?tid=G-0GWVSPJLVJ` with consent state `G111`, Ads/linker activity present.
3. **Withdrawal:** Settings modal revoke-all → reload → 0 GTM loads, 0 GA4 hits, 0 Ads hits.
4. **Marketing denial isolation:** `analytics:granted,marketing:denied` → GA4 fires, zero Ads network activity.
5. **Legacy removal:** no `G-ESL161CNBV` / `G-R2DDCBXXXX` in HTML, `analytics-env.js`, GTM container, or network traffic.
6. **Staging isolation:** runtime config `{"environment":"production"}`; no `GTM-M9DMRGCD` / `G-E8W6FZE6LP` anywhere; fail-closed host/branch gate in deployed bundle.
7. **Purchase integrity:** conversion config with orderId dedup live in container; no purchase events fired (no real payments).

## Owner Actions Completed

- Re-pasted fixed Consent Bridge into GTM-KLJZZM9; embedded tests T1–T5 PASS.
- Published GTM-KLJZZM9 version 17 (2026-10-12).
- Approved website merge + deployment.

## Outstanding / Housekeeping

- Local `master` pushed to `origin/master` with this commit.
- Untracked release-worktree items intentionally left: `GTM-KLJZZM9_workspace18.json` (owner-provided export), `_worker.js` CRLF-noise status entry, one CRLF stash.
- Deferred (from release-prep package): D1 ledger registration (053/054/055 classification), staging ledger cleanup, Cookie Settings footer styling polish.
