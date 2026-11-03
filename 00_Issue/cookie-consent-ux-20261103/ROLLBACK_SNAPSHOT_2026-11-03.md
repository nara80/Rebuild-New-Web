# Rollback Snapshot (Pre-deploy, 2026-11-03)

## Production deployments captured before release
Source: `wrangler pages deployment list --project-name=mildmate-new --environment=production --json`
- Current production deployment ID: `11a927a8-3edc-4e95-91b5-d559660517d2` (source `d07207b`)
- Immediate rollback candidate ID: `236b87fb-aadf-4bdd-909c-ae229058bb1f` (source `66e6b19`)
- Additional fallback IDs: `2b4581e9-bb68-4e4f-99d8-06410e72ebdf`, `2fe70380-ce79-4464-b9a7-0a56bb223183`

## Preview references used in this release
- Candidate preview deployment: `aa1ba781-cd9b-42c8-82b3-172ca0ea2d6a`
- Baseline preview deployment: `c1e59f4b-f156-43f3-b9ee-dcb6440c932c`
- Alias: `https://security-admin-api-remediati-p2nk.mildmate-new.pages.dev`

## Rollback action if critical regression appears
1. Stop further rollout checks.
2. Restore previous production deployment in Cloudflare Pages deployment controls using rollback candidate ID above.
3. Re-run critical smoke checks on consent, checkout, auth, and product routes.
4. Record incident evidence in `00_Issue/cookie-consent-ux-20261103/`.

## Local Git rollback method
- Scoped: `git restore <file...>`
- Runtime reset: `git restore public functions templates`
