const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../public/products/index.html');
const thPath = path.join(__dirname, '../public/th/products/index.html');

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

function processHtml(filePath, isTh) {
  let html = fs.readFileSync(filePath, 'utf8');

  // 1) Replace brand-hero subtitle
  if (isTh) {
    html = html.replace(
      '<h1>ค้นหาขนาดที่พอดีกับเตียงคุณ</h1>',
      '<h1>ค้นหาขนาดที่พอดีกับเตียงคุณ</h1>\n        <p class="hero-sub">เลือกดูสินค้าตามประเภทสินค้า รูปแบบเตียง หรือความต้องการสั่งตัดพิเศษ</p>'
    );
  } else {
    html = html.replace(
      '<p class="hero-sub">Standard sizes for 8 regions. Custom quotes for any shape.</p>',
      '<p class="hero-sub">Browse by product type, bed setup, or special application.</p>'
    );
  }

  // 2) Overwrite style block rules
  const styleEndIndex = html.indexOf('</style>');
  if (styleEndIndex !== -1) {
    const extraStyle = `
    /* --- Audit overrides for hero height and horizontal scrolling fades --- */
    .brand-hero { padding: 48px 24px 36px !important; }
    
    .filter-chips-wrapper {
      position: relative;
    }
    
    @media (max-width: 768px) {
      .filter-chips-wrapper::after {
        content: '';
        position: absolute;
        top: 0; right: 0; bottom: 4px;
        width: 32px;
        background: linear-gradient(to right, rgba(240,247,255,0), #f0f7ff);
        pointer-events: none;
        z-index: 2;
      }
    }
    
    /* Enforce 4:3 ratio on all screens */
    .product-card .product-image img { aspect-ratio: 4/3 !important; }
    
    /* Product card enhancements */
    .product-card .product-benefit { font-size: 0.8125rem; color: var(--color-text); margin-bottom: 8px; line-height: 1.4; flex-grow: 1; }
    .product-card .product-fabrics-info { font-size: 0.75rem; color: var(--color-muted); font-weight: 600; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.03em; }
    .product-card .product-title { min-height: auto !important; margin-bottom: 6px !important; }
    .product-card .product-price { margin-bottom: 4px !important; }
    .product-card .product-price-note { margin-bottom: 8px !important; }
    
    /* Control row & pagination styling */
    .controls-row select:focus { outline: none; border-color: var(--color-primary); }
    #load-more-btn:hover { background: var(--color-primary) !important; color: #fff !important; }
    `;
    html = html.substring(0, styleEndIndex) + extraStyle + html.substring(styleEndIndex);
  }

  // 3) Wrap filter sections in fade wrapper and adjust tags/names
  if (isTh) {
    html = html.replace(
      '<div class="filter-chips" id="filter-chips-type">',
      '<div class="filter-chips-wrapper"><div class="filter-chips" id="filter-chips-type">'
    );
    html = html.replace(
      '<button class="filter-chip active" data-filter="all">สินค้าทั้งหมด</button>',
      '<button class="filter-chip active" data-filter="all">สินค้าทั้งหมด</button>'
    );
    // End tags for type wrapper
    html = html.replace(
      '</div>\n        </div>\n\n        <!-- Filter Chips: Application Niches -->',
      '</div></div>\n        </div>\n\n        <!-- Filter Chips: Application Niches -->'
    );
    
    // Niche wrapper
    html = html.replace(
      '<div class="filter-chips" id="filter-chips-niche">',
      '<div class="filter-chips-wrapper"><div class="filter-chips" id="filter-chips-niche">'
    );
    // End tags for niche wrapper
    html = html.replace(
      '</div>\n        </div>\n\n        \n\n\n\n\n\n\n\n<div class="product-grid"',
      '</div></div>\n        </div>\n\n        \n\n\n\n\n\n\n\n<div class="product-grid"'
    );
    
    // Also translate Niche filter labels
    html = html.replace('data-filter="family">เตียงครอบครัว', 'data-filter="family">เตียงครอบครัว &amp; ที่นอนต่อกัน');
    html = html.replace('data-filter="marine">เรือ &amp; ยอชต์', 'data-filter="marine">เรือ &amp; ยอชต์');
    html = html.replace('data-filter="pets">คนเลี้ยงสัตว์', 'data-filter="pets">สำหรับบ้านเลี้ยงสัตว์');
    html = html.replace('data-filter="deep-pocket">ที่นอนหนาพิเศษ', 'data-filter="deep-pocket">ที่นอนหนาพิเศษ');
    html = html.replace('data-filter="boarding-dorm">เตียงหอพัก', 'data-filter="boarding-dorm">เตียงหอพัก &amp; นักเรียน');
    html = html.replace('data-filter="rv-truck">รถบ้าน &amp; รถบรรทุก', 'data-filter="rv-truck">รถบ้าน &amp; รถบรรทุก');
  } else {
    html = html.replace(
      '<div class="filter-chips" id="filter-chips-type">',
      '<div class="filter-chips-wrapper"><div class="filter-chips" id="filter-chips-type">'
    );
    html = html.replace(
      '<button class="filter-chip active" data-filter="all">Products</button>',
      '<button class="filter-chip active" data-filter="all">All Products</button>'
    );
    // End tags for type wrapper
    html = html.replace(
      '</div>\n        </div>\n\n        <!-- Filter Chips: Application Niches -->',
      '</div></div>\n        </div>\n\n        <!-- Filter Chips: Application Niches -->'
    );

    // Niche wrapper
    html = html.replace(
      '<div class="filter-chips" id="filter-chips-niche">',
      '<div class="filter-chips-wrapper"><div class="filter-chips" id="filter-chips-niche">'
    );
    // End tags for niche wrapper
    html = html.replace(
      '</div>\n        </div>\n\n        \n\n\n\n\n\n\n\n<div class="product-grid"',
      '</div></div>\n        </div>\n\n        \n\n\n\n\n\n\n\n<div class="product-grid"'
    );
    
    // Replace niche filter buttons to match audit spec
    html = html.replace('data-filter="family">Family &amp; Co-Sleep</button>', 'data-filter="family">Family &amp; Co-Sleep</button>');
    html = html.replace('data-filter="marine">Marine &amp; Yacht</button>', 'data-filter="marine">Marine &amp; Yacht</button>');
    html = html.replace('data-filter="pets">Pet Owner</button>', 'data-filter="pets">Pet-Friendly</button>');
    html = html.replace('data-filter="deep-pocket">Deep Pocket</button>', 'data-filter="deep-pocket">Deep Pocket</button>');
    html = html.replace('data-filter="boarding-dorm">Boarding Dorm</button>', 'data-filter="boarding-dorm">Dorm &amp; Student</button>');
    html = html.replace('data-filter="rv-truck">RV &amp; Truck Cab</button>', 'data-filter="rv-truck">RV &amp; Truck</button>');
    // Add missing filters
    html = html.replace(
      '<button class="filter-chip" data-filter="rv-truck">RV &amp; Truck</button>',
      '<button class="filter-chip" data-filter="rv-truck">RV &amp; Truck</button>\n            <button class="filter-chip" data-filter="adjustable">Adjustable Bed</button>\n            <button class="filter-chip" data-filter="custom-shape">Custom Shape</button>'
    );
  }

  // 4) Add missing adjustable/custom-shape data attributes to respective product cards in the grid.
  // Marine Fitted Sheet -> sheets,marine,custom-shape
  html = html.replace(
    'class="product-card" data-categories="sheets,marine"',
    'class="product-card" data-categories="sheets,marine,custom-shape"'
  );
  // RV & Truck Fitted Sheet -> sheets,rv-truck,custom-shape
  html = html.replace(
    'class="product-card" data-categories="sheets,rv-truck"',
    'class="product-card" data-categories="sheets,rv-truck,custom-shape"'
  );
  // Duvet Cover — Marine -> duvet-covers,marine,custom-shape
  html = html.replace(
    'class="product-card" data-categories="duvet-covers,marine"',
    'class="product-card" data-categories="duvet-covers,marine,custom-shape"'
  );
  // Duvet Cover — RV -> duvet-covers,rv-truck,custom-shape
  html = html.replace(
    'class="product-card" data-categories="duvet-covers,rv-truck"',
    'class="product-card" data-categories="duvet-covers,rv-truck,custom-shape"'
  );
  // 6-Sided Mattress Encasement -> protection,marine,rv-truck,custom-shape
  html = html.replace(
    'class="product-card" data-categories="protection,marine,rv-truck"',
    'class="product-card" data-categories="protection,marine,rv-truck,custom-shape"'
  );
  // RV & Truck Mattress Encasement -> protection,rv-truck,custom-shape
  html = html.replace(
    'class="product-card" data-categories="protection,rv-truck"',
    'class="product-card" data-categories="protection,rv-truck,custom-shape"'
  );

  // 5) Inject Controls Row, Load More button, and No-Results Box around the product grid
  const gridIndex = html.indexOf('<div class="product-grid"');
  if (gridIndex !== -1) {
    const controlsRow = isTh ? `
        <!-- Controls row: count, sort, clear -->
        <div class="controls-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; font-size: 0.875rem; color: var(--color-muted); flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 12px;">
          <div class="results-count" id="results-count">27 สินค้า</div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>เรียงตาม:</span>
              <select id="sort-control" style="padding: 6px 12px; border: 1px solid var(--color-border); border-radius: 4px; font-family: inherit; font-size: 0.875rem; background: #fff; cursor: pointer; color: var(--color-text);">
                <option value="featured">ยอดนิยม</option>
                <option value="price-low">ราคา: ต่ำ - สูง</option>
                <option value="price-high">ราคา: สูง - ต่ำ</option>
                <option value="name-asc">ชื่อ: A - Z</option>
                <option value="name-desc">ชื่อ: Z - A</option>
              </select>
            </div>
            <button id="clear-filters-btn" style="color: var(--color-primary); font-weight: 600; cursor: pointer; display: none; background: none; border: none; font-family: inherit; font-size: 0.875rem;">ล้างตัวกรอง</button>
          </div>
        </div>
        
        <!-- No result state -->
        <div id="no-results" style="display: none; text-align: center; padding: 60px 24px; background: #fff; border-radius: var(--radius); border: 1px dashed var(--color-border); margin-bottom: 40px;">
          <svg style="width: 48px; height: 48px; color: var(--color-muted); margin-bottom: 16px; display: inline-block;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--color-text); margin-bottom: 8px;">ไม่พบสินค้าที่ตรงตามตัวกรอง</h3>
          <p style="color: var(--color-muted); max-width: 400px; margin: 0 auto 24px;">ลองเปลี่ยนตัวกรอง หรือส่งรายละเอียดที่นอนของคุณมาเพื่อให้เราช่วยแนะนำขนาดสั่งตัด</p>
          <a href="/th/custom-measurement/" class="btn btn-primary" style="display: inline-block; padding: 12px 32px; text-decoration: none;">เริ่มขอใบเสนอราคา</a>
        </div>
    ` : `
        <!-- Controls row: count, sort, clear -->
        <div class="controls-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; font-size: 0.875rem; color: var(--color-muted); flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 12px;">
          <div class="results-count" id="results-count">27 products</div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>Sort:</span>
              <select id="sort-control" style="padding: 6px 12px; border: 1px solid var(--color-border); border-radius: 4px; font-family: inherit; font-size: 0.875rem; background: #fff; cursor: pointer; color: var(--color-text);">
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name-asc">Name: A-Z</option>
                <option value="name-desc">Name: Z-A</option>
              </select>
            </div>
            <button id="clear-filters-btn" style="color: var(--color-primary); font-weight: 600; cursor: pointer; display: none; background: none; border: none; font-family: inherit; font-size: 0.875rem;">Clear Filters</button>
          </div>
        </div>
        
        <!-- No result state -->
        <div id="no-results" style="display: none; text-align: center; padding: 60px 24px; background: #fff; border-radius: var(--radius); border: 1px dashed var(--color-border); margin-bottom: 40px;">
          <svg style="width: 48px; height: 48px; color: var(--color-muted); margin-bottom: 16px; display: inline-block;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--color-text); margin-bottom: 8px;">No exact matches found</h3>
          <p style="color: var(--color-muted); max-width: 400px; margin: 0 auto 24px;">Try removing a filter, or send us your mattress details for a custom recommendation.</p>
          <a href="/custom-measurement/" class="btn btn-primary" style="display: inline-block; padding: 12px 32px; text-decoration: none;">Start a Custom Quote</a>
        </div>
    `;
    
    html = html.substring(0, gridIndex) + controlsRow + html.substring(gridIndex);
  }

  // Insert load-more container after grid close
  const gridCloseIndex = html.indexOf('</div>\n      \n      \n      \n      \n      \n      \n      \n\n        \n      </div>\n    </section>');
  if (gridCloseIndex !== -1) {
    const loadMoreBtn = isTh ? `
        <!-- Load More button -->
        <div id="load-more-container" style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
          <button id="load-more-btn" style="background: transparent; border: 2px solid var(--color-primary); color: var(--color-primary); padding: 12px 32px; border-radius: var(--radius); font-weight: 700; font-size: 0.9375rem; cursor: pointer; transition: all 0.2s; display: inline-block;">แสดงสินค้าเพิ่มเติม</button>
        </div>
    ` : `
        <!-- Load More button -->
        <div id="load-more-container" style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
          <button id="load-more-btn" style="background: transparent; border: 2px solid var(--color-primary); color: var(--color-primary); padding: 12px 32px; border-radius: var(--radius); font-weight: 700; font-size: 0.9375rem; cursor: pointer; transition: all 0.2s; display: inline-block;">Load More Products</button>
        </div>
    `;
    // Find index of </div> right after grid
    const targetDivIndex = html.indexOf('</div>', gridIndex + 500); // look for closing product-grid
    if (targetDivIndex !== -1) {
      html = html.substring(0, targetDivIndex + 6) + loadMoreBtn + html.substring(targetDivIndex + 6);
    }
  }

  // 6) Standardize each product-card element programmatically
  // We extract all <article class="product-card"> elements and rewrite their HTML blocks
  const cardRegex = /<article class="product-card"([^>]*)>([\s\S]*?)<\/article>/g;
  let matches;
  let updatedHtml = html;

  while ((matches = cardRegex.exec(html)) !== null) {
    const originalCard = matches[0];
    const attrs = matches[1];
    const cardContent = matches[2];

    // Find product slug from the link
    const linkMatch = cardContent.match(/href="\/product\/([^/"]+)\/?"/);
    if (!linkMatch) continue;
    const slug = linkMatch[1];
    const data = productsData[slug];
    if (!data) continue;

    const title = isTh ? data.titleTH : data.title;
    const benefit = isTh ? data.benefitTH : data.benefit;
    const fabrics = isTh ? data.fabricsTH : data.fabrics;
    const ctaText = data.custom 
      ? (isTh ? "ออกแบบและสั่งตัด" : "Customize This Product")
      : (isTh ? "เลือกขนาดและเนื้อผ้า" : "Choose Size & Fabric");

    // Standardize price
    const priceText = isTh 
      ? `เริ่มต้น ฿${data.thb.toLocaleString('th-TH')}` 
      : `From US$${data.usd}`;
    const priceNote = isTh
      ? "ไม่รวมค่าจัดส่ง ภาษี และภาษีศุลกากร"
      : "Excludes shipping, tax & tariff";

    // Tags rendering
    const tagsArray = isTh ? data.tagsTH : data.tags;
    const tagsHtml = tagsArray.map(t => {
      // Map category name to lower-case path
      let linkPath = '/products/';
      if (t === 'Sheets' || t === 'ผ้าปูที่นอน') linkPath = '/sheets/';
      else if (t === 'Duvet Covers' || t === 'ปลอกผ้านวม') linkPath = '/duvet-covers/';
      else if (t === 'Pillowcases' || t === 'ปลอกหมอน') linkPath = '/pillowcases/';
      else if (t === 'Protection' || t === 'ผ้ารองกันเปื้อน') linkPath = '/protection/';
      else if (t === 'Accessories' || t === 'อุปกรณ์เสริม') linkPath = '/accessories/';
      
      const localizedPath = isTh ? '/th' + linkPath : linkPath;
      return `<a href="${localizedPath}" class="card-tag" style="text-decoration:none;">${t.toUpperCase()}</a>`;
    }).join('');

    // Extract image tag
    const imgMatch = cardContent.match(/<img[^>]+src="([^"]+)"[^>]*>/);
    const imgSrc = imgMatch ? imgMatch[1] : `/images/products/${slug}/main.jpg`;

    const standardizedCard = `<article class="product-card"${attrs} data-title="${title.toLowerCase()}" data-price="${isTh ? data.thb : data.usd}">
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
              <a href="${isTh ? '/th' : ''}/product/${slug}/" class="btn btn-primary" style="margin-top:auto;">${ctaText}</a>
            </div>
          </article>`;

    updatedHtml = updatedHtml.replace(originalCard, standardizedCard);
  }

  // 7) Overwrite JavaScript filtering/sorting/pagination block at the bottom
  const jsStart = updatedHtml.indexOf('// Visual chip filter');
  const jsEnd = updatedHtml.indexOf('})();', jsStart);
  if (jsStart !== -1 && jsEnd !== -1) {
    const newJs = `// Visual chip filter — multi-select/single-select with sort and pagination
    (function() {
      var chips = document.querySelectorAll('.filter-chip');
      var grid = document.querySelector('.product-grid');
      var cards = Array.prototype.slice.call(document.querySelectorAll('.product-card'));
      var countEl = document.getElementById('results-count');
      var sortSelect = document.getElementById('sort-control');
      var clearBtn = document.getElementById('clear-filters-btn');
      var noResults = document.getElementById('no-results');
      var loadMoreBtn = document.getElementById('load-more-btn');
      var loadMoreContainer = document.getElementById('load-more-container');
      
      var itemsPerPage = 12;
      var visibleLimit = itemsPerPage;
      var activeFilters = { type: 'all', niche: 'all' };

      function updateGrid() {
        var filtered = [];
        
        cards.forEach(function(card) {
          var cats = (card.getAttribute('data-categories') || '').split(',');
          
          var typeMatch = (activeFilters.type === 'all');
          var nicheMatch = (activeFilters.niche === 'all');
          
          cats.forEach(function(cat) {
            cat = cat.trim();
            if (cat === activeFilters.type) typeMatch = true;
            if (cat === activeFilters.niche) nicheMatch = true;
          });
          
          if (typeMatch && nicheMatch) {
            filtered.push(card);
          } else {
            card.style.display = 'none';
          }
        });

        // Apply Sorting
        var sortBy = sortSelect.value;
        filtered.sort(function(a, b) {
          if (sortBy === 'price-low') {
            return parseFloat(a.getAttribute('data-price')) - parseFloat(b.getAttribute('data-price'));
          } else if (sortBy === 'price-high') {
            return parseFloat(b.getAttribute('data-price')) - parseFloat(a.getAttribute('data-price'));
          } else if (sortBy === 'name-asc') {
            return a.getAttribute('data-title').localeCompare(b.getAttribute('data-title'));
          } else if (sortBy === 'name-desc') {
            return b.getAttribute('data-title').localeCompare(a.getAttribute('data-title'));
          }
          return 0; // Default Featured (HTML order)
        });

        // Re-append sorted elements in DOM
        filtered.forEach(function(card) {
          grid.appendChild(card);
        });

        // Handle Pagination & Visibility
        if (filtered.length === 0) {
          noResults.style.display = 'block';
          grid.style.display = 'none';
          loadMoreContainer.style.display = 'none';
        } else {
          noResults.style.display = 'none';
          grid.style.display = '';
          
          filtered.forEach(function(card, idx) {
            if (idx < visibleLimit) {
              card.style.display = '';
            } else {
              card.style.display = 'none';
            }
          });
          
          if (filtered.length > visibleLimit) {
            loadMoreContainer.style.display = '';
          } else {
            loadMoreContainer.style.display = 'none';
          }
        }

        // Update counts
        var total = filtered.length;
        if (countEl) {
          countEl.textContent = ${isTh ? 'total + " สินค้า"' : 'total + " " + (total === 1 ? "product" : "products")'};
        }

        // Toggle clear filters button visibility
        if (activeFilters.type !== 'all' || activeFilters.niche !== 'all') {
          clearBtn.style.display = 'inline-block';
        } else {
          clearBtn.style.display = 'none';
        }
      }

      // Wire filter chips click listeners
      chips.forEach(function(chip) {
        chip.addEventListener('click', function() {
          var filter = this.getAttribute('data-filter');
          var isNiche = this.parentNode.id === 'filter-chips-niche';
          
          // Toggle active state in sibling chips
          var siblings = this.parentNode.querySelectorAll('.filter-chip');
          siblings.forEach(function(c) { c.classList.remove('active'); });
          
          if (isNiche) {
            if (activeFilters.niche === filter) {
              activeFilters.niche = 'all';
            } else {
              this.classList.add('active');
              activeFilters.niche = filter;
            }
          } else {
            if (activeFilters.type === filter) {
              activeFilters.type = 'all';
            } else {
              this.classList.add('active');
              activeFilters.type = filter;
            }
          }
          
          // Reset page limit on filter change
          visibleLimit = itemsPerPage;
          updateGrid();
        });
      });

      // Clear filters button
      clearBtn.addEventListener('click', function() {
        chips.forEach(function(c) { c.classList.remove('active'); });
        document.querySelector('#filter-chips-type [data-filter="all"]').classList.add('active');
        activeFilters.type = 'all';
        activeFilters.niche = 'all';
        visibleLimit = itemsPerPage;
        updateGrid();
      });

      // Sort select listener
      sortSelect.addEventListener('change', function() {
        updateGrid();
      });

      // Load more listener
      loadMoreBtn.addEventListener('click', function() {
        visibleLimit += itemsPerPage;
        updateGrid();
      });

      // Run initial load
      updateGrid();`;
    
    updatedHtml = updatedHtml.substring(0, jsStart) + newJs + updatedHtml.substring(jsEnd);
  }

  fs.writeFileSync(filePath, updatedHtml, 'utf8');
}

processHtml(enPath, false);
processHtml(thPath, true);
console.log('Product pages successfully updated.');
