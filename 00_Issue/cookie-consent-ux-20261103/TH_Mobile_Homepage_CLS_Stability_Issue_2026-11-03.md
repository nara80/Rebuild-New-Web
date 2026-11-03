# TH Mobile Homepage CLS Stability Issue (Tracking Note)

Date: 2026-11-03
Scope: Tracking only (no redesign in this release)

## Decision
Per owner direction, this is recorded as a separate issue. We do **not** expand into layout redesign in this release unless a reproducible regression is proven.

## Current evidence
- Earlier comparison runs showed intermittent CLS spikes on TH mobile home in both baseline and updated builds (non-deterministic).
- Final consolidated release-pass run (baseline `c1e59f4b` vs candidate `aa1ba781`) did **not** reproduce a TH CLS regression:
  - `before_mobile_th`: CLS `0.001`
  - `after_mobile_th`: CLS `0.002`
- Home EN HTML payload hash is identical between those builds, indicating no homepage markup drift from this release.

## Interpretation
No reproducible CLS regression attributable to this release has been confirmed.

## Follow-up (separate workstream)
1. Run multi-pass Lighthouse/trace sampling focused on `/th/` mobile with cold-cache variance controls.
2. Capture layout-shift element attribution for each spike sample.
3. Isolate deterministic triggers (font swap timing, injected blocks, media dimension timing, etc.) before proposing any UI/layout change.
