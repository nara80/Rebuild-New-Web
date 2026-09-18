// Regression suite for the confirmed-mapping parser.
//
// Every case below is a real D1_Product_Map value observed in the production
// Notion OrderList during the Phase 07 ramp and the Phase 08 historical
// backfill (487 orders). This suite is the safety net for any refactor of the
// parser — it must stay green before and after.
//
// Run: node scripts/notion-mapper-parser.test.mjs
//
// IMPORT_TARGET lets the same suite verify the CLI and the extracted core are
// behaviourally identical during the Phase 17 port.

const IMPORT_TARGET = process.env.PARSER_IMPORT || "./notion-mapper-core.mjs";
const mod = await import(IMPORT_TARGET);
const { parseConfirmedMap, parseConfirmedIds } = mod;

let pass = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push({ name, a, e });
    console.log(`  FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
  }
}

// Compact shape for comparison: [product_id, quantity] per item.
function shape(res) {
  if (!res.ok) return { ok: false };
  return { ok: true, items: res.items.map((i) => [i.product_id, i.quantity]) };
}

console.log("\n=== Format A (current Make.com output) ===");

check(
  "A1 two items, semicolon separated",
  shape(parseConfirmedMap(
    "Item 1 | D1 20 | Mattress Protector, Family & Co-Sleep | Qty 1; Item 2 | D1 26 | BedBridge Connector | Qty 1"
  )),
  { ok: true, items: [[20, 1], [26, 1]] }
);

check(
  "A2 newline separated with Status suffix",
  shape(parseConfirmedMap(
    "Item 1 | D1 1 | Standard Fitted Sheet | Qty 1 | Status Mapped\n" +
    "Item 2 | D1 1 | Standard Fitted Sheet | Qty 1 | Status Mapped\n" +
    "Item 3 | D1 16 | Envelope Pillowcase | Qty 2 | Status Mapped\n" +
    "Item 4 | D1 16 | Envelope Pillowcase | Qty 2 | Status Mapped"
  )),
  { ok: true, items: [[1, 1], [1, 1], [16, 2], [16, 2]] }
);

check(
  "A3 etsy three-line repeat id, mixed qty",
  shape(parseConfirmedMap(
    "Item 1 | D1 34 | Weighted Blanket Cover | Qty 3 | Status Mapped\n" +
    "Item 2 | D1 34 | Weighted Blanket Cover | Qty 3 | Status Mapped\n" +
    "Item 3 | D1 34 | Weighted Blanket Cover | Qty 1 | Status Mapped"
  )),
  { ok: true, items: [[34, 3], [34, 3], [34, 1]] }
);

check(
  "A4 title containing a comma is preserved as one piece",
  parseConfirmedMap("Item 1 | D1 20 | Mattress Protector, Family & Co-Sleep | Qty 1").items[0].title,
  "Mattress Protector, Family & Co-Sleep"
);

check(
  "A5 missing Qty defaults to 1",
  shape(parseConfirmedMap("Item 1 | D1 6 | Family Fitted Sheet")),
  { ok: true, items: [[6, 1]] }
);

check(
  "A6 five items (LuQpJi23 web order)",
  shape(parseConfirmedMap(
    "Item 1 | D1 1 | A | Qty 1; Item 2 | D1 2 | B | Qty 1; Item 3 | D1 3 | C | Qty 1; " +
    "Item 4 | D1 4 | D | Qty 1; Item 5 | D1 5 | E | Qty 1"
  )),
  { ok: true, items: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]] }
);

console.log("\n=== Format B (older, standalone 'MildMate -> id' piece) ===");

check(
  "B1 arrow id in its own piece",
  shape(parseConfirmedMap(
    "Line 1 | Fitted Sheet 6 inch | MildMate -> 6 | Family Fitted Sheet | Mapped"
  )),
  { ok: true, items: [[6, 1]] }
);

check(
  "B2 title taken from piece after the arrow",
  parseConfirmedMap(
    "Line 1 | Fitted Sheet 6 inch | MildMate -> 6 | Family Fitted Sheet | Mapped"
  ).items[0].title,
  "Family Fitted Sheet"
);

console.log("\n=== Format C (2026-09-12, arrow at END of a Thai description piece) ===");

check(
  "C1 arrow terminating a description piece",
  shape(parseConfirmedMap(
    "Line 1 | ผ้าปูที่นอนกันน้ำ ขนาด 6 ฟุต -> 20 | Mattress Protector | Mapped"
  )),
  { ok: true, items: [[20, 1]] }
);

check(
  "C2 falls back to first piece for title when next piece is 'Mapped'",
  parseConfirmedMap("Line 1 | Some Source Title -> 26 | Mapped").items[0].title,
  "Some Source Title"
);

console.log("\n=== Stray status fragments (manual-edit artefacts) ===");

check(
  "S1 trailing '| Mapped' fragment line is ignored",
  shape(parseConfirmedMap("Item 1 | D1 1 | Standard Fitted Sheet | Qty 1\n| Mapped")),
  { ok: true, items: [[1, 1]] }
);

check(
  "S2 bare 'Mapped' line is ignored",
  shape(parseConfirmedMap("Item 1 | D1 1 | Standard Fitted Sheet | Qty 1\nMapped")),
  { ok: true, items: [[1, 1]] }
);

check(
  "S3 'Status Mapped' line is ignored",
  shape(parseConfirmedMap("Item 1 | D1 1 | Standard Fitted Sheet | Qty 1\nStatus Mapped")),
  { ok: true, items: [[1, 1]] }
);

console.log("\n=== Held records: must fail, never guess ===");

check(
  "H1 empty map",
  shape(parseConfirmedMap("")),
  { ok: false }
);

check(
  "H2 null map",
  shape(parseConfirmedMap(null)),
  { ok: false }
);

check(
  "H3 'Review Required | No Parsed Item' (the 7 group-C backfill holds)",
  shape(parseConfirmedMap("Review Required | No Parsed Item")),
  { ok: false }
);

check(
  "H4 multi-id line needs manual handling",
  shape(parseConfirmedMap("Line 1 | Bundle -> 6, 26 | Combo | Mapped")),
  { ok: false }
);

check(
  "H5 multi-id with ampersand",
  shape(parseConfirmedMap("Line 1 | Bundle -> 6 & 26 | Combo | Mapped")),
  { ok: false }
);

check(
  "H6 unrecognized segment shape",
  shape(parseConfirmedMap("total 2 items, 3 pcs")),
  { ok: false }
);

check(
  "H7 the 'tem 4' typo (ID 630 before fix) must not silently drop the line",
  parseConfirmedMap(
    "Item 1 | D1 1 | Standard Fitted Sheet | Qty 1\ntem 4 | D1 16 | Envelope Pillowcase | Qty 2"
  ).ok,
  false
);

console.log("\n=== parseConfirmedIds ===");

check("I1 comma separated", parseConfirmedIds("1, 1, 16, 16"), [1, 1, 16, 16]);
check("I2 single id", parseConfirmedIds("3"), [3]);
check("I3 empty", parseConfirmedIds(""), []);
check("I4 null", parseConfirmedIds(null), []);
check("I5 semicolon separated", parseConfirmedIds("6;26"), [6, 26]);
check("I6 drops zero and non-numeric", parseConfirmedIds("4, 0, abc, 7"), [4, 7]);
check("I7 tolerates whitespace", parseConfirmedIds("  20 ,  26  "), [20, 26]);

console.log(`\n${"=".repeat(60)}`);
console.log(`Target: ${IMPORT_TARGET}`);
console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log("FAILED — do not proceed with the refactor.");
  process.exit(1);
}
console.log("ALL PASS");
