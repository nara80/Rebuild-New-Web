const fs = require('fs');
const path = require('path');

const productsData = {
  "standard-fitted-sheet": {
    title: "Standard Fitted Sheet",
    titleTH: "ผ้าปูที่นอนแบบรัดมุม (ขนาดมาตรฐาน)",
    tags: ["Sheets"],
    tagsTH: ["ผ้าปูที่นอน"],
    usd: 38,
    thb: 1345,
    benefit: "Made to fit standard mattresses with a smooth, secure finish.",
    benefitTH: "ออกแบบพอดีสำหรับที่นอนขนาดมาตรฐาน ให้ความเรียบตึงไม่หลุดง่าย",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "deep-pocket-fitted-sheet": {
    title: "Deep Pocket Fitted Sheet",
    titleTH: "ผ้าปูที่นอนสำหรับที่นอนหนาพิเศษ (Deep Pocket)",
    tags: ["Sheets", "Deep Pocket"],
    tagsTH: ["ผ้าปูที่นอน", "ที่นอนหนาพิเศษ"],
    usd: 42,
    thb: 1485,
    benefit: "Designed for tall mattresses, toppers, and extra-deep setups.",
    benefitTH: "สำหรับที่นอนสูง ท็อปเปอร์หนา หรือเตียงหนาพิเศษโดยเฉพาะ",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "marine-fitted-sheet": {
    title: "Marine & Yacht Fitted Sheet",
    titleTH: "ผ้าปูที่นอนสำหรับเรือและยอชต์ (Marine)",
    tags: ["Sheets", "Marine & Yacht"],
    tagsTH: ["ผ้าปูที่นอน", "เรือและยอชต์"],
    usd: 52,
    thb: 1835,
    benefit: "Custom-fit for V-berths and unusual boat mattress shapes.",
    benefitTH: "สั่งตัดพอดีรูปทรง V-Berth และที่นอนรูปทรงเฉพาะบนเรือ",
    fabrics: "Custom size · Multiple fabrics",
    fabricsTH: "สั่งตัดพิเศษ · เลือกเนื้อผ้าได้หลากหลาย",
    custom: true
  },
  "dorm-fitted-sheet": {
    title: "Dorm & Student Fitted Sheet",
    titleTH: "ผ้าปูที่นอนสำหรับหอพักและนักเรียนต่างประเทศ",
    tags: ["Sheets", "Dorm & Student"],
    tagsTH: ["ผ้าปูที่นอน", "เตียงหอพัก"],
    usd: 38,
    thb: 1345,
    benefit: "Made for dormitory and overseas student-bed dimensions.",
    benefitTH: "พอดีตามขนาดเตียงหอพักนักเรียน ทั้งในและต่างประเทศ",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "rv-truck-fitted-sheet": {
    title: "RV & Truck Sleeper Fitted Sheet",
    titleTH: "ผ้าปูที่นอนสำหรับรถบ้านและรถบรรทุก (RV & Truck)",
    tags: ["Sheets", "RV & Truck"],
    tagsTH: ["ผ้าปูที่นอน", "รถบ้านและรถบรรทุก"],
    usd: 48,
    thb: 1695,
    benefit: "Designed for compact vehicle mattresses and sleeper cabins.",
    benefitTH: "ขนาดพอดีกับเบาะที่นอนในรถบ้านและห้องโดยสารรถบรรทุก",
    fabrics: "Custom size · Multiple fabrics",
    fabricsTH: "สั่งตัดพิเศษ · เลือกเนื้อผ้าได้หลากหลาย",
    custom: true
  },
  "family-fitted-sheet": {
    title: "Family & Co-Sleep Fitted Sheet",
    titleTH: "ผ้าปูที่นอนสำหรับเตียงครอบครัว (Family Bed)",
    tags: ["Sheets", "Family Bed"],
    tagsTH: ["ผ้าปูที่นอน", "เตียงครอบครัว"],
    usd: 45,
    thb: 1590,
    benefit: "A seamless fitted sheet for joined and oversized family beds.",
    benefitTH: "ผ้าปูผืนเดียวแบบไร้รอยต่อสำหรับเตียงขนาดใหญ่หรือเตียงต่อกัน",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "pet-owner-fitted-sheet": {
    title: "Pet-Friendly Fitted Sheet",
    titleTH: "ผ้าปูที่นอนสำหรับบ้านเลี้ยงสัตว์ (Pet-Friendly)",
    tags: ["Sheets", "Pet-Friendly"],
    tagsTH: ["ผ้าปูที่นอน", "สำหรับบ้านเลี้ยงสัตว์"],
    usd: 48,
    thb: 1695,
    benefit: "BreezePlus fabric - scratch-resistant and easy to brush off pet hair.",
    benefitTH: "ผ้า BreezePlus ขนสัตว์ไม่ติดเนื้อผ้า ปัดออกง่าย ทนต่อเล็บข่วน",
    fabrics: "1 fabric · 11 colors available",
    fabricsTH: "ผ้า BreezePlus · มี 11 สี",
    custom: false
  },
  "flat-sheet-standard": {
    title: "Flat Sheet - Standard",
    titleTH: "ผ้าห่ม/ผ้าปูผืนราบ (ขนาดมาตรฐาน)",
    tags: ["Sheets"],
    tagsTH: ["ผ้าปูที่นอน"],
    usd: 38,
    thb: 1345,
    benefit: "Classic flat sheet styling for home and hotel setups.",
    benefitTH: "สไตล์คลาสสิกสำหรับคลุมที่นอนหรือห่มนอน สไตล์โรงแรม",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "flat-sheet-extra-deep-pocket": {
    title: "Flat Sheet - Extra Deep Pocket",
    titleTH: "ผ้าปูผืนราบสำหรับที่นอนหนาพิเศษ",
    tags: ["Sheets", "Deep Pocket"],
    tagsTH: ["ผ้าปูที่นอน", "ที่นอนหนาพิเศษ"],
    usd: 42,
    thb: 1485,
    benefit: "Oversized flat sheet designed for tall, layered mattresses.",
    benefitTH: "ผ้าปูผืนราบขนาดใหญ่พิเศษสำหรับที่นอนสูงหรือหลายชั้น",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "3-sided-duvet": {
    title: "3-Sided Zipper Duvet Cover",
    titleTH: "ปลอกผ้านวมซิป 3 ด้าน (เตียงครอบครัว)",
    tags: ["Duvet Covers", "Family Bed"],
    tagsTH: ["ปลอกผ้านวม", "เตียงครอบครัว"],
    usd: 65,
    thb: 2295,
    benefit: "Oversized duvet cover with a 3-sided zipper for easy insertion.",
    benefitTH: "ปลอกผ้านวมขนาดใหญ่พิเศษ ซิป 3 ด้าน ถอดใส่ไส้นวมได้ง่าย",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "pet-owner-duvet-cover": {
    title: "Pet-Friendly Duvet Cover",
    titleTH: "ปลอกผ้านวมสำหรับบ้านเลี้ยงสัตว์ (Pet-Friendly)",
    tags: ["Duvet Covers", "Pet-Friendly"],
    tagsTH: ["ปลอกผ้านวม", "สำหรับบ้านเลี้ยงสัตว์"],
    usd: 72,
    thb: 2545,
    benefit: "BreezePlus fabric protecting against pet hair and claws.",
    benefitTH: "ผ้า BreezePlus ป้องกันการเกาะของขนสัตว์และทนทานรอยขีดข่วน",
    fabrics: "1 fabric · 11 colors available",
    fabricsTH: "ผ้า BreezePlus · มี 11 สี",
    custom: false
  },
  "duvet-cover-marine": {
    title: "Marine & Yacht Duvet Cover",
    titleTH: "ปลอกผ้านวมสำหรับเรือและยอชต์",
    tags: ["Duvet Covers", "Marine & Yacht"],
    tagsTH: ["ปลอกผ้านวม", "เรือและยอชต์"],
    usd: 78,
    thb: 2755,
    benefit: "Custom-shaped duvet cover designed for compact boat cabins.",
    benefitTH: "สั่งตัดตามรูปทรงเตียงในห้องนอนเรือขนาดกะทัดรัด",
    fabrics: "Custom size · Multiple fabrics",
    fabricsTH: "สั่งตัดพิเศษ · เลือกเนื้อผ้าได้หลากหลาย",
    custom: true
  },
  "duvet-cover-rv": {
    title: "RV & Truck Sleeper Duvet Cover",
    titleTH: "ปลอกผ้านวมสำหรับรถบ้านและรถบรรทุก",
    tags: ["Duvet Covers", "RV & Truck"],
    tagsTH: ["ปลอกผ้านวม", "รถบ้านและรถบรรทุก"],
    usd: 72,
    thb: 2545,
    benefit: "Custom duvet cover to fit vehicle and sleeping berths.",
    benefitTH: "สั่งตัดพอดีกับรูปทรงผ้านวมและเบาะนอนในห้องโดยสาร",
    fabrics: "Custom size · Multiple fabrics",
    fabricsTH: "สั่งตัดพิเศษ · เลือกเนื้อผ้าได้หลากหลาย",
    custom: true
  },
  "duvet-cover-dorm": {
    title: "Dorm & Student Duvet Cover",
    titleTH: "ปลอกผ้านวมสำหรับหอพักและนักเรียนต่างประเทศ",
    tags: ["Duvet Covers", "Dorm & Student"],
    tagsTH: ["ปลอกผ้านวม", "เตียงหอพัก"],
    usd: 62,
    thb: 2190,
    benefit: "Sized perfectly for dormitory and student-accommodation inserts.",
    benefitTH: "ขนาดเหมาะสมกับหอพักนักเรียน สะดวกสไตล์โมเดิร์น",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "duvet-insert": {
    title: "Duvet Insert",
    titleTH: "ไส้ผ้านวมสำเร็จรูป",
    tags: ["Duvet Covers"],
    tagsTH: ["ปลอกผ้านวม"],
    usd: 45,
    thb: 1590,
    benefit: "Fluffy and lightweight duvet insert for perfect temperature control.",
    benefitTH: "ไส้ผ้านวมน้ำหนักเบา นุ่มฟู ระบายอากาศและเก็บความอบอุ่นพอดี",
    fabrics: "1 fabric · White only",
    fabricsTH: "ผ้าไมโครไฟเบอร์ · สีขาว",
    custom: false
  },
  "pillowcase-envelope": {
    title: "Envelope Pillowcase",
    titleTH: "ปลอกหมอนแบบซอง (Envelope)",
    tags: ["Pillowcases"],
    tagsTH: ["ปลอกหมอน"],
    usd: 16,
    thb: 565,
    benefit: "Classic fold-over envelope design for easy pillow changing.",
    benefitTH: "ดีไซน์สวมซองแบบคลาสสิก ถอดซักและสวมใส่สะดวก",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "pillowcase-zipper": {
    title: "Zipper Pillowcase",
    titleTH: "ปลอกหมอนแบบมีซิป (Zipper)",
    tags: ["Pillowcases"],
    tagsTH: ["ปลอกหมอน"],
    usd: 18,
    thb: 635,
    benefit: "Fully zipped closure, protecting pillow against dust mites.",
    benefitTH: "ซิปรูดปิดมิดชิด ป้องกันไรฝุ่นและการสัมผัสโดยตรง",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "pillowcase-sham": {
    title: "Sham Pillowcase",
    titleTH: "ปลอกหมอนขอบระบายสไตล์โรงแรม (Sham)",
    tags: ["Pillowcases"],
    tagsTH: ["ปลอกหมอน"],
    usd: 20,
    thb: 705,
    benefit: "Decorative border styling for a luxury hotel appearance.",
    benefitTH: "แต่งขอบระบายหรูหราสไตล์โรงแรม ช่วยให้หมอนดูสวยงาม",
    fabrics: "4 fabrics · 23 colors available",
    fabricsTH: "มีให้เลือก 4 เนื้อผ้า · 23 สี",
    custom: false
  },
  "mattress-protector-standard": {
    title: "Mattress Protector - Standard",
    titleTH: "ผ้ารองกันเปื้อนที่นอน (ขนาดมาตรฐาน)",
    tags: ["Protection"],
    tagsTH: ["ผ้ารองกันเปื้อน"],
    usd: 26,
    thb: 915,
    benefit: "Water-resistant barrier shield that protects standard mattresses.",
    benefitTH: "แผ่นรองกันคราบและกันน้ำซึมเปื้อน ปกป้องที่นอนขนาดมาตรฐาน",
    fabrics: "TPU layer · Easy care",
    fabricsTH: "ผ้ากันน้ำ TPU · ดูแลรักษาง่าย",
    custom: false
  },
  "mattress-protector-family": {
    title: "Mattress Protector - Family",
    titleTH: "ผ้ารองกันเปื้อนสำหรับเตียงครอบครัว",
    tags: ["Protection", "Family Bed"],
    tagsTH: ["ผ้ารองกันเปื้อน", "เตียงครอบครัว"],
    usd: 35,
    thb: 1235,
    benefit: "Seamless protective layer for oversized co-sleeping beds.",
    benefitTH: "ผ้ารองกันเปื้อนผืนเดียวไร้รอยต่อ สำหรับเตียงครอบครัวขนาดใหญ่",
    fabrics: "TPU layer · Easy care",
    fabricsTH: "ผ้ากันน้ำ TPU · ดูแลรักษาง่าย",
    custom: false
  },
  "mattress-protector-deep-pocket": {
    title: "Mattress Protector - Deep Pocket",
    titleTH: "ผ้ารองกันเปื้อนสำหรับที่นอนหนาพิเศษ",
    tags: ["Protection", "Deep Pocket"],
    tagsTH: ["ผ้ารองกันเปื้อน", "ที่นอนหนาพิเศษ"],
    usd: 30,
    thb: 1055,
    benefit: "Fits extra-tall pocket depths with full elastic skirt protection.",
    benefitTH: "สำหรับที่นอนสูงหรือเสริมท็อปเปอร์ กระชับพอดีด้วยขอบยางยืด",
    fabrics: "TPU layer · Easy care",
    fabricsTH: "ผ้ากันน้ำ TPU · ดูแลรักษาง่าย",
    custom: false
  },
  "pet-proof-mattress-protector": {
    title: "Pet-Proof Mattress Protector",
    titleTH: "ผ้ารองกันเปื้อนป้องกันสัตว์เลี้ยง (Pet-Proof)",
    tags: ["Protection", "Pet-Friendly"],
    tagsTH: ["ผ้ารองกันเปื้อน", "สำหรับบ้านเลี้ยงสัตว์"],
    usd: 32,
    thb: 1125,
    benefit: "Scratch-resistant heavy shield against pet urine and claws.",
    benefitTH: "ทนเล็บสัตว์เลี้ยง กันปัสสาวะซึมเปื้อนลงบนที่นอน",
    fabrics: "BreezePlus + TPU layer",
    fabricsTH: "ผ้า BreezePlus + แผ่นกันน้ำ TPU",
    custom: false
  },
  "mattress-encasement-general": {
    title: "6-Sided Mattress Encasement",
    titleTH: "ปลอกหุ้มที่นอนกันไรฝุ่นและกันน้ำ 6 ด้าน",
    tags: ["Protection", "Marine & Yacht"],
    tagsTH: ["ผ้ารองกันเปื้อน", "เรือและยอชต์"],
    usd: 55,
    thb: 1945,
    benefit: "Full 6-sided zippered protection against moisture and dust mites.",
    benefitTH: "ปลอกซิบหุ้มที่นอนทั้ง 6 ด้าน กันน้ำและความชื้น 100% กันไรฝุ่น",
    fabrics: "TPU closure · 360 protection",
    fabricsTH: "ผ้ากันน้ำ TPU · ป้องกันรอบด้าน 360 องศา",
    custom: true
  },
  "rv-truck-mattress-encasement": {
    title: "RV & Truck Mattress Encasement",
    titleTH: "ปลอกหุ้มที่นอนสำหรับรถบ้านและรถบรรทุก",
    tags: ["Protection", "RV & Truck"],
    tagsTH: ["ผ้ารองกันเปื้อน", "รถบ้านและรถบรรทุก"],
    usd: 58,
    thb: 2045,
    benefit: "Heavy zippered protector designed for mobile cabin mattresses.",
    benefitTH: "หุ้มที่นอนสำหรับรถบ้านและรถบรรทุก ป้องกันกลิ่นอับและความชื้น",
    fabrics: "TPU closure · Custom size",
    fabricsTH: "ผ้ากันน้ำ TPU · สั่งตัดตามขนาด",
    custom: true
  },
  "pillow-protector-general": {
    title: "Pillow Protector",
    titleTH: "ปลอกหมอนกันเปื้อนและไรฝุ่น",
    tags: ["Protection"],
    tagsTH: ["ผ้ารองกันเปื้อน"],
    usd: 18,
    thb: 635,
    benefit: "Zipped moisture shield extending the lifetime of your pillow.",
    benefitTH: "ป้องกันคราบเหงื่อ ความชื้น และน้ำลาย ช่วยยืดอายุการใช้งานของหมอน",
    fabrics: "TPU layer · Comfort soft",
    fabricsTH: "ผ้ากันน้ำ TPU · นุ่มนอนสบาย",
    custom: false
  },
  "bedbridge-connector": {
    title: "BedBridge Connector",
    titleTH: "ตัวต่อที่นอนและสายรัดเตียง (BedBridge)",
    tags: ["Accessories", "Family Bed"],
    tagsTH: ["อุปกรณ์เสริม", "เตียงครอบครัว"],
    usd: 45,
    thb: 1590,
    benefit: "Connects two mattress pads seamlessly with a center bridge foam.",
    benefitTH: "แผ่นโฟมต่อช่องว่างระหว่างที่นอน 2 หลัง พร้อมสายรัดยึดเตียง",
    fabrics: "Hypoallergenic foam",
    fabricsTH: "โฟมนุ่มปลอดภัย · พร้อมสายรัดยาวพิเศษ",
    custom: false
  },
  "mattress-lift-helper": {
    title: "Bed Lifter (38 cm)",
    titleTH: "อุปกรณ์ช่วยยกที่นอน (38 ซม.)",
    tags: ["Accessories"],
    tagsTH: ["อุปกรณ์เสริม"],
    usd: 22,
    thb: 790,
    benefit: "Ergonomic wedge lifter making bedsheet changing effortless.",
    benefitTH: "ตัวช่วยสอดใต้ที่นอนช่วยยกสลักเตียง ผ่อนแรงเวลาปูผ้าปูที่นอน",
    fabrics: "Heavy duty ABS",
    fabricsTH: "พลาสติก ABS เกรดทนทานสูง",
    custom: false
  }
};

const folders = [
  'sheets',
  'duvet-covers',
  'pillowcases',
  'protection',
  'accessories',
  'marine',
  'family',
  'pets',
  'deep-pocket',
  'boarding-dorm',
  'rv-truck'
];

const files = [];
folders.forEach(f => {
  files.push({ relPath: `public/${f}/index.html`, isTh: false });
  files.push({ relPath: `public/th/${f}/index.html`, isTh: true });
});

function getCategoriesAttr(data) {
  const cats = data.tags.map(t => {
    if (t === 'Sheets') return 'sheets';
    if (t === 'Duvet Covers') return 'duvet-covers';
    if (t === 'Pillowcases') return 'pillowcases';
    if (t === 'Protection') return 'protection';
    if (t === 'Accessories') return 'accessories';
    if (t === 'Deep Pocket') return 'deep-pocket';
    if (t === 'Marine & Yacht') return 'marine';
    if (t === 'Dorm & Student') return 'boarding-dorm';
    if (t === 'RV & Truck') return 'rv-truck';
    if (t === 'Family Bed') return 'family';
    if (t === 'Pet-Friendly') return 'pets';
    return t.toLowerCase().replace(/\s+/g, '-');
  });
  if (data.custom) {
    cats.push('custom-shape');
  }
  return cats.join(',');
}

function getTagsHtml(data, isTh) {
  const tagsArray = isTh ? data.tagsTH : data.tags;
  return tagsArray.map(t => {
    let linkPath = '/products/';
    if (t === 'Sheets' || t === 'ผ้าปูที่นอน') linkPath = '/sheets/';
    else if (t === 'Duvet Covers' || t === 'ปลอกผ้านวม') linkPath = '/duvet-covers/';
    else if (t === 'Pillowcases' || t === 'ปลอกหมอน') linkPath = '/pillowcases/';
    else if (t === 'Protection' || t === 'ผ้ารองกันเปื้อน') linkPath = '/protection/';
    else if (t === 'Accessories' || t === 'อุปกรณ์เสริม') linkPath = '/accessories/';
    else if (t === 'Deep Pocket' || t === 'ที่นอนหนาพิเศษ') linkPath = '/deep-pocket/';
    else if (t === 'Marine & Yacht' || t === 'เรือและยอชต์') linkPath = '/marine/';
    else if (t === 'Dorm & Student' || t === 'เตียงหอพัก') linkPath = '/boarding-dorm/';
    else if (t === 'RV & Truck' || t === 'รถบ้านและรถบรรทุก') linkPath = '/rv-truck/';
    else if (t === 'Family Bed' || t === 'เตียงครอบครัว') linkPath = '/family/';
    else if (t === 'Pet-Friendly' || t === 'สำหรับบ้านเลี้ยงสัตว์') linkPath = '/pets/';

    const localizedPath = isTh ? '/th' + linkPath : linkPath;
    return `<a href="${localizedPath}" class="card-tag" style="text-decoration:none;">${t.toUpperCase()}</a>`;
  }).join('');
}

function processFile(fileObj) {
  const filePath = path.join(__dirname, '..', fileObj.relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${fileObj.relPath}`);
    return;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // 1) Replace listing-grid/listing-card css declarations inside the style block
  html = html.replace(/\.listing-grid\s*{[^}]*}/g, '');
  html = html.replace(/\.listing-card\s*{[^}]*}/g, '');
  html = html.replace(/\.listing-card\s+\.card-[a-zA-Z-]+\s*{[^}]*}/g, '');
  html = html.replace(/\.listing-card:hover\s*{[^}]*}/g, '');
  html = html.replace(/\.listing-card:hover\s+\.card-image\s+img\s*{[^}]*}/g, '');
  html = html.replace(/\.listing-card\s+\.btn\s*{[^}]*}/g, '');
  html = html.replace(/\.listing-card\s+\.card-video-badge\s*{[^}]*}/g, '');
  html = html.replace(/\.listing-card\s+\.card-image\s+img\s*{\s*aspect-ratio:\s*[^}]+}/gi, '');
  html = html.replace(/\.product-card\s+\.product-image\s+img\s*{\s*aspect-ratio:\s*[^}]+}/gi, '');

  // Inject new css styles right before </style>
  const styleEndIndex = html.indexOf('</style>');
  if (styleEndIndex !== -1) {
    const cleanStyles = `
    /* Standardized Product Grid & Cards */
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px; }
    .product-card { background: var(--color-bg); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; transition: transform var(--transition), box-shadow var(--transition); display: flex; flex-direction: column; }
    .product-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
    .product-image { width: 100%; aspect-ratio: 4/3; background: var(--color-surface); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
    .product-image img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--transition); }
    .product-card:hover .product-image img { transform: scale(1.03); }
    .product-info { padding: 16px; flex: 1; display: flex; flex-direction: column; }
    .product-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .card-tag { font-size: 0.6875rem; font-weight: 600; color: var(--color-primary); background: #e8f4fd; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.03em; }
    .product-title { font-size: 1rem; font-weight: 700; color: var(--color-text); margin-bottom: 6px !important; line-height: 1.35; min-height: auto !important; }
    .product-price { font-size: 1.125rem; font-weight: 700; color: var(--color-primary); margin-bottom: 4px !important; }
    .product-price-note { font-size: 0.7188rem; color: var(--color-muted); margin-bottom: 8px !important; line-height: 1.2; }
    .product-benefit { font-size: 0.8125rem; color: var(--color-text); margin-bottom: 8px; line-height: 1.4; flex-grow: 1; }
    .product-fabrics-info { font-size: 0.75rem; color: var(--color-muted); font-weight: 600; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.03em; }
    .product-card .btn { display: block; text-align: center; text-decoration: none; padding: 12px; border-radius: var(--radius); font-weight: 600; font-size: 0.9375rem; transition: background 0.2s; }
    `;
    html = html.substring(0, styleEndIndex) + cleanStyles + html.substring(styleEndIndex);
  }

  // 2) Standardize grid container class
  html = html.replace(/class="listing-grid"/g, 'class="product-grid"');

  // 3) Locate and replace each card block
  const cardRegex = /<article class="(?:listing-card|product-card)"([^>]*)>([\s\S]*?)<\/article>/g;
  let matches;
  let updatedHtml = html;

  while ((matches = cardRegex.exec(html)) !== null) {
    const originalCard = matches[0];
    const attrs = matches[1];
    const cardContent = matches[2];

    // Find the product slug
    const linkMatch = cardContent.match(/href="\/(?:th\/)?product\/([^/"]+)\/?"/);
    if (!linkMatch) {
      console.log(`Warning: product slug not found in card in ${fileObj.relPath}`);
      continue;
    }
    const slug = linkMatch[1];
    const data = productsData[slug];
    if (!data) {
      console.log(`Warning: productsData not found for slug "${slug}" in ${fileObj.relPath}`);
      continue;
    }

    const title = fileObj.isTh ? data.titleTH : data.title;
    const benefit = fileObj.isTh ? data.benefitTH : data.benefit;
    const fabrics = fileObj.isTh ? data.fabricsTH : data.fabrics;
    const ctaText = data.custom
      ? (fileObj.isTh ? "ออกแบบสั่งตัดพิเศษ" : "Customize This Product")
      : (fileObj.isTh ? "เลือกขนาดและเนื้อผ้า" : "Choose Size & Fabric");

    const priceText = fileObj.isTh
      ? `เริ่มต้น ฿${data.thb.toLocaleString('th-TH')}`
      : `From US$${data.usd}`;
    const priceNote = fileObj.isTh
      ? "ไม่รวมค่าจัดส่ง ภาษี และภาษีศุลกากร"
      : "Excludes shipping, tax & tariff";

    const tagsHtml = getTagsHtml(data, fileObj.isTh);
    const categoriesAttr = getCategoriesAttr(data);

    // Extract image path
    const imgMatch = cardContent.match(/<img[^>]+src="([^"]+)"[^>]*>/);
    const imgSrc = imgMatch ? imgMatch[1] : `/images/products/${slug}/main.jpg`;

    // Construct the standardized card
    const standardizedCard = `<article class="product-card" data-categories="${categoriesAttr}" data-title="${title.toLowerCase()}" data-price="${fileObj.isTh ? data.thb : data.usd}">
            <div class="product-image">
              <img src="${imgSrc}" alt="${title}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="product-info">
              <div class="product-tags" aria-label="Categories">${tagsHtml}</div>
              <h3 class="product-title">${title}</h3>
              <div class="product-price" data-usd="${data.usd}" data-thb="${data.thb}">${priceText}</div>
              <div class="product-price-note">${priceNote}</div>
              <p class="product-benefit">${benefit}</p>
              <div class="product-fabrics-info">${fabrics}</div>
              <a href="${fileObj.isTh ? '/th' : ''}/product/${slug}/" class="btn btn-primary" style="margin-top:auto;">${ctaText}</a>
            </div>
          </article>`;

    updatedHtml = updatedHtml.replace(originalCard, standardizedCard);
  }

  fs.writeFileSync(filePath, updatedHtml, 'utf8');
  console.log(`Successfully updated: ${fileObj.relPath}`);
}

// Process all files
files.forEach(processFile);
console.log('All niche and category landing pages are updated successfully.');
