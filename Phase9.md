# Phase 9 — Testing (Vitest + Worker Testing)
**Status (2026-06-10): ⏸️ PENDING — Not started. Vitest not installed.**

## Overview

Add Vitest as the test framework for unit-testing Cloudflare Worker API logic. No browser needed — Workers run in Cloudflare's V8 isolate environment, so tests run against the actual worker code using `describe()`, `it()`, and assertion helpers from Vitest.

---

## Scope

### Worker API Unit Tests (Vitest)

Test the business logic layer in isolation — no need to spin up a full Workers runtime for pure function tests.

| Worker | What to Test |
|---|---|
| `workers/api/pricing.ts` | V-Berth trapezoid formula, fitted sheet area, cm↔inch conversion, fabric rate multipliers |
| `workers/api/cart.ts` | Cart JSON add/remove/update, currency lock, quote item handling |
| `workers/api/geo-currency.ts` | Country→currency mapping (TH→THB, rest→USD), localStorage unit preference |
| `workers/api/subscribers.ts` | Email validation regex, duplicate email rejection, source tagging |
| `workers/api/quote.ts` | Quote ID generation (QT-YYMMDD-NNN), status transitions, expiry logic |
| `workers/api/products.ts` | Slug→product lookup, category filter, base_price vs price_per_sqcm selection |

### Cloudflare-specific Tests

Use `@cloudflare/vitest-pool-workers` to run tests inside the Workers runtime:

- `workers/api/webhook.ts` — Stripe signature verification (HMAC-SHA256)
- `workers/api/checkout.ts` — Session creation, payment status transitions

---

## Test File Structure

```
workers/
  api/
    pricing.test.ts      ← V-Berth + fitted sheet pricing
    cart.test.ts         ← Cart operations
    geo-currency.test.ts ← Country/currency mapping
    subscribers.test.ts   ← Email validation + dedup
    quote.test.ts         ← Quote ID + status machine
    products.test.ts     ← Product lookup + filters
    webhook.test.ts       ← Stripe HMAC verification
```

---

## Test Patterns

### Pure Logic Tests (Vitest standard)
```ts
import { describe, it, expect } from 'vitest';
import { calculateFittedSheetPrice } from './pricing';

describe('calculateFittedSheetPrice', () => {
  it('computes area in cm correctly', () => {
    const price = calculateFittedSheetPrice({ w: 153, l: 203, d: 30 }, 'PremaCotton');
    expect(price).toBeGreaterThan(0);
  });

  it('converts inch to cm before calculation', () => {
    const price = calculateFittedSheetPrice({ w: 60, l: 80, d: 12 }, 'PremaCotton', 'inch');
    expect(price).toBeGreaterThan(0);
  });

  it('applies fabric rate multiplier correctly', () => {
    const basic = calculateFittedSheetPrice({ w: 100, l: 200, d: 20 }, 'CloudSoft');
    const premium = calculateFittedSheetPrice({ w: 100, l: 200, d: 20 }, 'EcoLuxe');
    expect(premium).toBeGreaterThan(basic);
  });
});
```

### V-Berth Trapezoid Tests
```ts
describe('calculateVBerthPrice', () => {
  it('uses average width × length for trapezoid area', () => {
    // Head=80cm (bow), Foot=120cm (cabin), Length=200cm
    const price = calculateVBerthPrice({ head: 80, foot: 120, l: 200, d: 15 }, 'PremaCotton');
    expect(price).toBeGreaterThan(0);
    // ((80+120)/2) × 200 = 20,000 cm²
  });

  it('handles equal head/foot (rectangle fallback)', () => {
    const rect = calculateVBerthPrice({ head: 100, foot: 100, l: 200, d: 20 }, 'CloudSoft');
    expect(rect).toBe(100 * 200 * pricePerSqCm_CloudSoft * (20 + 2)); // depth margin
  });
});
```

### Stripe Webhook HMAC Test
```ts
describe('verifyStripeSignature', () => {
  it('accepts valid HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ type: 'checkout.session.completed' });
    const sig = computeHmac(payload, STRIPE_WEBHOOK_SECRET);
    const result = verifyStripeSignature(payload, sig);
    expect(result).toBe(true);
  });

  it('rejects tampered payload', () => {
    const sig = computeHmac('{"type":"evil"}', STRIPE_WEBHOOK_SECRET);
    expect(verifyStripeSignature('{"type":"checkout.session.completed"}', sig)).toBe(false);
  });
});
```

---

## Setup

```bash
npm install -D vitest @cloudflare/vitest-pool-workers
```

**vitest.config.ts:**
```ts
import { defineConfig } from 'vitest/config';
import cloudflarePool from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [cloudflarePool()],
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: 'wrangler.toml' }
      }
    }
  }
});
```

**package.json scripts:**
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

---

## CI Integration

GitHub Actions workflow (`.github/workflows/test.yml`):

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test
```

---

## Phase 9 Tasks

- [ ] Install Vitest + `@cloudflare/vitest-pool-workers`
- [ ] Configure `vitest.config.ts`
- [ ] Write `pricing.test.ts` — V-Berth trapezoid + fitted sheet formulas
- [ ] Write `cart.test.ts` — Cart add/remove/update + currency lock
- [ ] Write `geo-currency.test.ts` — Country→currency mapping
- [ ] Write `subscribers.test.ts` — Email validation + dedup
- [ ] Write `quote.test.ts` — Quote ID generation + status machine
- [ ] Write `products.test.ts` — Product lookup + category filter
- [ ] Write `webhook.test.ts` — Stripe HMAC verification
- [ ] Add `test` + `test:watch` scripts to `package.json`
- [ ] Add GitHub Actions workflow `.github/workflows/test.yml`
- [ ] Run full test suite + fix failures
- [ ] Commit Phase 9

---

## Exit Criteria

- All 7 test files created and passing (`npm run test` exits 0)
- `npm run test:coverage` produces a coverage report
- GitHub Actions green on every push
- Zero suppressed or skipped tests
