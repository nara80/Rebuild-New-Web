// Tier-0 helper: builds the quote follow-up worklist markdown from a wrangler d1 JSON dump.
// Usage: node scripts/build-quote-worklist.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const raw = readFileSync('logs/quote_followup_raw.json', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(raw)[0].results;
const active = data.filter(r => r.validity === 'ACTIVE');
const expired = data.filter(r => r.validity === 'EXPIRED');

const row = (r, i, withShip) =>
  `| ${i + 1} | ${r.quote_id} | ${r.customer_name} | ${r.email} | ${r.product_slug} | $${r.quoted_price_usd ?? '—'}${withShip ? ` | ${r.free_shipping ? 'Yes' : 'No'}` : ''} | ${r.created_at} | ${r.expires_at ?? '—'} |`;

let md = `# Quote Follow-up Worklist — Tier 0
Generated: 2026-10-27 from prod D1 (\`status='approved'\` AND no matching order by email)

Total: **${data.length}** quotes — ACTIVE: **${active.length}** | EXPIRED: **${expired.length}**

## ACTIVE — follow up now (sorted by expiry, soonest first)

| # | Quote ID | Name | Email | Product | Price | Free Ship | Created | Expires |
|---|---|---|---|---|---|---|---|---|
${active.map((r, i) => row(r, i, true)).join('\n')}

## EXPIRED — optional revival (re-approve with a new expiry in Super Admin BEFORE emailing)

| # | Quote ID | Name | Email | Product | Price | Created | Expired |
|---|---|---|---|---|---|---|---|
${expired.map((r, i) => row(r, i, false)).join('\n')}

## Ritual (repeat weekly)
1. Re-generate this list (ask Droid: "refresh quote worklist").
2. ACTIVE quotes older than 3 days: send Template A from contact@mildmate.com.
3. ACTIVE quotes expiring within 7 days: send Template B instead.
4. EXPIRED quotes worth reviving: Super Admin → Quotes → set new expiry + re-send magic link, then Template B.
5. Log outcome next to each row (replied / ordered / dead) — keeps next week's pass short.
`;

writeFileSync('00_Issue/Quote_Followup_Worklist_2026-10-27.md', md, 'utf8');
console.log(`ACTIVE=${active.length} EXPIRED=${expired.length}`);
console.log('Soonest-expiring ACTIVE:');
for (const r of active.slice(0, 5)) console.log(` ${r.quote_id}  ${r.product_slug}  $${r.quoted_price_usd}  expires ${r.expires_at}`);
