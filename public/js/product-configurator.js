/* ============================================
   MildMate Product Configurator — Phase 4+
   Fitted sheet real pricing formula
   Hybrid: standard size presets + custom W×L×D
   Applies to: standard-fitted-sheet, deep-pocket-fitted-sheet, dorm-fitted-sheet, rv-truck-fitted-sheet
   ============================================ */

(function () {
  // ── Detect product variant ──
  var path = window.location.pathname;
  var isRVTruck = path.indexOf('rv-truck') !== -1;
  var isFlatSheet = path.indexOf('flat-sheet') !== -1;
  var isEncasement = path.indexOf('encasement') !== -1;
  var isPetOwner = path.indexOf('pet-owner') !== -1;
  var isFamily = path.indexOf('family-fitted-sheet') !== -1;
  var isDuvet = path.indexOf('duvet') !== -1;
  var isPillowProtector = path.indexOf('pillow-protector') !== -1;
  var isPillowcase = path.indexOf('pillowcase') !== -1;
  var pillowVariant = 'envelope';
  if (isPillowcase) {
    if (path.indexOf('zipper') !== -1) pillowVariant = 'zipper';
    else if (path.indexOf('sham') !== -1) pillowVariant = 'sham';
  }

  // ── Pricing constants (THB) ──
  var SQCM_PER_YARD = 23744;
  var PACKING = 100;
  var DELIVERY = 50;
  var OP_RATE = 0.15;
  var MKT_RATE = 0.20;
  var MARGIN_RATE = isRVTruck ? 0.45 : isFamily ? 0.50 : 0.30;
  var MARKUP = 1 + OP_RATE + MKT_RATE + MARGIN_RATE; // 1.65 standard, 1.80 RV, 1.85 family
  var THB_TO_USD = 30;
  var MAX_W = isFamily ? 9999 : 220;

  var FABRIC_RATES = {
    cloudsoft: 100,
    breezeplus: 180,
    premacotton: 180,
    ecoluxe: 180
  };

  var FABRIC_LABELS = {
    cloudsoft: 'CloudSoft — Everyday comfort · OEKO-TEX',
    breezeplus: 'BreezePlus — Anti-fur · Pet-proof · Siriraj certified',
    premacotton: 'PremaCotton — Premium long-staple · OEKO-TEX',
    ecoluxe: 'EcoLuxe — Natural unbleached cotton'
  };

  var SEWING_TIERS = [
    { max: 51600, cost: 120 },
    { max: 71000, cost: 200 },
    { max: 91200, cost: 300 },
    { max: 120000, cost: 400 },
    { max: Infinity, cost: 500 }
  ];

  var DUVET_SEWING_TIERS = [
    { max: 139200, cost: 300 },
    { max: 170400, cost: 400 },
    { max: Infinity, cost: 600 }
  ];

  // ── Pillow constants ──
  var PILLOW_WASTE = 1.60;      // 60% waste
  var PILLOW_SEWING = 40;       // THB
  var MAX_PILLOW = 120;         // max W or L cm
  var TPU_COST_PER_SQCM = 120 / 21000; // 120 THB/lm ÷ 21,000 cm²/lm

  function getSewingCost(area) {
    for (var i = 0; i < SEWING_TIERS.length; i++) {
      if (area <= SEWING_TIERS[i].max) return SEWING_TIERS[i].cost;
    }
    return 500;
  }

  function getDuvetSewingCost(area) {
    for (var i = 0; i < DUVET_SEWING_TIERS.length; i++) {
      if (area <= DUVET_SEWING_TIERS[i].max) return DUVET_SEWING_TIERS[i].cost;
    }
    return 600;
  }

  // ── Flat sheet constants ──
  var FLAT_TUCK = 25;   // cm each side for underneath tuck + sewing allowance
  var FLAT_SEWING = 250; // fixed sewing cost (no elastic)

  // ── Encasement constants (TPU) ──
  var TPU_COST_PER_LM = 120;       // THB per linear metre (210cm bolt)
  var TPU_BOLT_W = 210;            // cm
  var TPU_SQCM_PER_LM = 100 * TPU_BOLT_W; // 21,000
  var ENC_SEWING = 300;            // flat rate THB
  var ZIPPER_RATE = 0.4;           // THB/cm
  var ENC_OP = 0.15;
  var ENC_MKT = 0.25;
  var ENC_MARGIN = 0.50;
  var ENC_MARKUP = 1 + ENC_OP + ENC_MKT + ENC_MARGIN; // 1.90

  function calcEncasement(wCm, lCm, dCm) {
    // 6-sided surface area
    var area = 2 * (wCm * lCm + wCm * dCm + lCm * dCm);
    // TPU fabric cost
    var fabricCost = (TPU_COST_PER_LM * area / TPU_SQCM_PER_LM) * 1.20;
    // Sewing
    var sewingCost = ENC_SEWING;
    // Zipper on 3 sides: L + W + L = 2L + W
    var zipperCost = (2 * lCm + wCm) * ZIPPER_RATE;
    // Subtotal
    var subtotal = fabricCost + sewingCost + zipperCost + PACKING + DELIVERY;
    // Markup
    var total = subtotal * ENC_MARKUP;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100 };
  }

  function calcDuvet(wCm, lCm, fabric) {
    // 2 pieces × (W+5) × (L+5) — 5cm sewing allowance on each edge, +20% waste
    var rawArea = 2 * (wCm + 5) * (lCm + 5);
    var area = rawArea * 1.20;
    var yardRate = FABRIC_RATES[fabric] || 100;
    var fabricCost = (area * yardRate / SQCM_PER_YARD);
    // Zipper: 0.4 THB/cm × (2L + W)
    var zipperCost = 0.4 * (2 * lCm + wCm);
    var sewingCost = getDuvetSewingCost(rawArea);
    var subtotal = fabricCost + zipperCost + sewingCost + PACKING + DELIVERY;
    var total = subtotal * MARKUP;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100 };
  }

  function calcPillowProtector(wCm, lCm) {
    // 2 pieces × (W+5) × (L+5) + 60% waste, TPU fabric
    var rawArea = 2 * (wCm + 5) * (lCm + 5);
    var area = rawArea * PILLOW_WASTE;
    // TPU fabric cost: 120 THB/lm, 210cm bolt
    var fabricCost = area * TPU_COST_PER_SQCM;
    // Zipper: 0.4 THB/cm on longest side
    var zipperCost = 0.4 * Math.max(wCm, lCm);
    var sewingCost = PILLOW_SEWING;
    var subtotal = fabricCost + zipperCost + sewingCost + PACKING + DELIVERY;
    // 15/25/35% markup = 1.75
    var total = subtotal * (1 + OP_RATE + MKT_RATE + 0.35);
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100 };
  }

  function calcPillowcase(wCm, lCm, fabric, variant) {
    var rawArea = 2 * (wCm + 5) * (lCm + 5);
    if (variant === 'sham') rawArea *= 1.15;
    var area = rawArea * PILLOW_WASTE;
    var yardRate = FABRIC_RATES[fabric] || 100;
    var fabricCost = (area * yardRate / SQCM_PER_YARD);
    var zipperCost = variant === 'zipper' ? 0.4 * Math.max(wCm, lCm) : 0;
    var sewingCost = variant === 'sham' ? 50 : PILLOW_SEWING;
    var subtotal = fabricCost + zipperCost + sewingCost + PACKING + DELIVERY;
    // 15/25/15% markup = 1.55
    var total = subtotal * (1 + OP_RATE + MKT_RATE + 0.15);
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100 };
  }

  function calcFlatSheet(wCm, lCm, dCm, fabric) {
    var fw = wCm + 2 * dCm + FLAT_TUCK * 2;
    var fl = lCm + 2 * dCm + FLAT_TUCK * 2;
    var area = fw * fl;
    var yardRate = FABRIC_RATES[fabric] || 100;
    var fabricCost = (area * yardRate / SQCM_PER_YARD) * 1.20;
    var sewingCost = FLAT_SEWING;
    var subtotal = fabricCost + sewingCost + PACKING + DELIVERY;
    var total = subtotal * MARKUP;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100, fw: fw, fl: fl };
  }

  function calcFittedSheet(wCm, lCm, dCm, fabric) {
    var fw = wCm + 2 * dCm + 14;
    var fl = lCm + 2 * dCm + 14;
    var area = fw * fl;
    var yardRate = FABRIC_RATES[fabric] || 100;
    var fabricCost = (area * yardRate / SQCM_PER_YARD) * 1.20;
    var sewingCost = getSewingCost(area);
    var accessories = fabricCost * 0.10;
    var subtotal = fabricCost + sewingCost + accessories + PACKING + DELIVERY;
    var total = subtotal * MARKUP;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100, fw: fw, fl: fl };
  }

  function inchToCm(v) { return v * 2.54; }
  function cmToInch(v) { return v * 0.393701; }

  // ── DOM refs ──
  var sizeSelect = document.getElementById('size-select');
  var fabricSelect = document.getElementById('fabric-select');
  var priceDisplay = document.getElementById('price-display');
  var addToCartBtn = document.getElementById('add-to-cart');
  var customQuoteBtn = document.getElementById('custom-quote-btn');
  var customDims = document.getElementById('custom-dimensions');
  var customPrice = document.getElementById('custom-price');

  // Custom dimension inputs
  var dimW = document.getElementById('dim-width');
  var dimL = document.getElementById('dim-length');
  var dimD = document.getElementById('dim-depth');
  var unitCmBtn = document.getElementById('unit-cm');
  var unitInBtn = document.getElementById('unit-in');

  var state = {
    unit: 'cm',
    fabric: 'cloudsoft',
    quotePriceThb: 0,
    quotePriceUsd: 0
  };

  if (!fabricSelect && !sizeSelect) return; // Not a configurator page — exit

  if (isPetOwner) state.fabric = 'breezeplus'; // Pet Owner products: BreezePlus only
  if (isDuvet && path.indexOf('rv') !== -1) state.fabric = 'cloudsoft'; // RV & Truck duvet: CloudSoft only
  if (isDuvet && path.indexOf('marine') !== -1) state.fabric = 'cloudsoft'; // Marine duvet: CloudSoft only

  // Duvet covers & pillow protectors only need W×L — hide the depth input
  if ((isDuvet || isPillowProtector || isPillowcase) && dimD) {
    var dimDGroup = dimD.closest('.dim-field') || dimD.closest('.input-group');
    if (dimDGroup) dimDGroup.style.display = 'none';
  }

  // ── Populate size-select from centralized size data ──
  function populateSizeSelect() {
    if (!sizeSelect || typeof PRODUCT_SIZES === 'undefined') return;
    var typeKey = isDuvet ? 'duvet' : (isPillowcase || isPillowProtector) ? 'pillow' : 'fitted-sheet';
    var sizes = PRODUCT_SIZES[typeKey];
    if (!sizes) return;

    var regionLabels = { us: '\uD83C\uDDFA\uD83C\uDDF8 US / Canada', uk: '\uD83C\uDDEC\uD83C\uDDE7 UK', eu: '\uD83C\uDDEA\uD83C\uDDFA EU', th: '\uD83C\uDDF9\uD83C\uDDED Thailand', au: '\uD83C\uDDE6\uD83C\uDDFA AU', my: '\uD83C\uDDF2\uD83C\uDDFE MY / SG', jp: '\uD83C\uDDEF\uD83C\uDDF5 Japan' };
    sizeSelect.innerHTML = '<option value="">\u2014 Choose size \u2014</option>';

    for (var region in sizes) {
      if (!sizes.hasOwnProperty(region)) continue;
      var items = sizes[region];
      var label = regionLabels[region] || region.toUpperCase();
      var optgroup = document.createElement('optgroup');
      optgroup.label = label;
      for (var i = 0; i < items.length; i++) {
        var s = items[i];
        var option = document.createElement('option');
        option.value = typeKey === 'fitted-sheet' ? s.w + 'x' + s.l + 'x' + s.d : s.w + 'x' + s.l;
        option.textContent = region === 'us'
          ? s.label + ' ' + s.inch + '\u2033'
          : s.label + ' \u2014 ' + s.cm + ' cm';
        optgroup.appendChild(option);
      }
      sizeSelect.appendChild(optgroup);
    }
    var customGrp = document.createElement('optgroup');
    customGrp.label = 'Custom Size';
    var customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Custom dimensions \u2192';
    customGrp.appendChild(customOpt);
    sizeSelect.appendChild(customGrp);
  }
  populateSizeSelect();

  // ── Inject quote popup HTML ──
  var popupHTML = '' +
    '<div class="quote-overlay" id="quote-overlay">' +
      '<div class="quote-popup">' +
        '<button class="quote-close" id="quote-close">&times;</button>' +
        '<h3 class="quote-popup-title">Custom Quote</h3>' +
        '<form id="quote-form" novalidate>' +
          '<label class="quote-field">Name <span class="quote-req">*</span>' +
            '<input type="text" id="qf-name" required placeholder="Your full name">' +
            '<span class="quote-err" id="qf-name-err"></span></label>' +
          '<label class="quote-field">Email <span class="quote-req">*</span>' +
            '<input type="email" id="qf-email" required placeholder="your@email.com">' +
            '<span class="quote-err" id="qf-email-err"></span></label>' +
          '<label class="quote-field">Address' +
            '<input type="text" id="qf-address" placeholder="Optional"></label>' +
          '<label class="quote-field">Telephone' +
            '<input type="text" id="qf-phone" placeholder="Optional"></label>' +
          '<!-- honeypot -->' +
          '<div style="position:absolute;left:-9999px" aria-hidden="true">' +
            '<label>Leave this empty <input type="text" name="_website" tabindex="-1" autocomplete="off"></label>' +
          '</div>' +
          '<button type="submit" class="quote-submit-btn" id="qf-submit">Submit</button>' +
          '<p class="quote-form-note">We\'ll email you within 24 hours.</p>' +
        '</form>' +
      '</div>' +
    '</div>' +
    '<div class="quote-overlay" id="confirm-overlay">' +
      '<div class="quote-popup">' +
        '<button class="quote-close" id="confirm-close">&times;</button>' +
        '<div class="quote-confirm-icon">&#10003;</div>' +
        '<h3 class="quote-popup-title">Quote Submitted</h3>' +
        '<p class="quote-confirm-text" id="confirm-text"></p>' +
        '<div class="quote-confirm-details" id="confirm-details"></div>' +
        '<button class="quote-submit-btn" id="confirm-ok">OK</button>' +
      '</div>' +
    '</div>';

  var tmp = document.createElement('div');
  tmp.innerHTML = popupHTML;
  while (tmp.firstChild) document.body.appendChild(tmp.firstChild);

  var styleEl = document.createElement('style');
  styleEl.textContent = '' +
    '.quote-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;align-items:center;justify-content:center}' +
    '.quote-overlay.open{display:flex}' +
    '.quote-popup{background:#fff;border-radius:12px;padding:32px;width:90%;max-width:440px;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.18);animation:qSlide .25s ease}' +
    '@keyframes qSlide{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}' +
    '.quote-close{position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;color:#999;cursor:pointer;line-height:1}' +
    '.quote-close:hover{color:#333}' +
    '.quote-popup-title{font-size:1.35rem;font-weight:700;color:#1a7fd4;margin:0 0 20px;text-align:center}' +
    '.quote-field{display:block;margin-bottom:14px;font-size:.9rem;color:#555}' +
    '.quote-field input{display:block;width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:.95rem;margin-top:4px;box-sizing:border-box}' +
    '.quote-field input:focus{border-color:#2c96f4;outline:none;box-shadow:0 0 0 3px rgba(44,150,244,.15)}' +
    '.quote-req{color:#e53e3e}' +
    '.quote-err{font-size:.8rem;color:#e53e3e;display:none;margin-top:2px}' +
    '.quote-err.show{display:block}' +
    '.quote-submit-btn{width:100%;padding:12px;background:#2c96f4;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:8px;transition:background .2s}' +
    '.quote-submit-btn:hover{background:#1a7fd4}' +
    '.quote-submit-btn:disabled{opacity:.6;cursor:not-allowed}' +
    '.quote-form-note{font-size:.8rem;color:#888;text-align:center;margin:12px 0 0}' +
    '.quote-confirm-icon{width:56px;height:56px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px}' +
    '.quote-confirm-text{text-align:center;color:#555;margin:0 0 16px;line-height:1.5}' +
    '.quote-confirm-details{background:#f8f9fa;border-radius:8px;padding:14px;margin-bottom:16px;font-size:.9rem;color:#555;line-height:1.6}' +
    '.quote-confirm-details strong{color:#333}';
  document.head.appendChild(styleEl);

  // ── Parse "WxLxD" string from option value ──
  function parseSizeVal(val) {
    if (!val || val === 'custom') return null;
    var parts = val.split('x');
    if (parts.length === 3) {
      return { w: parseFloat(parts[0]), l: parseFloat(parts[1]), d: parseFloat(parts[2]) };
    }
    if (parts.length === 2) {
      return { w: parseFloat(parts[0]), l: parseFloat(parts[1]), d: 0 };
    }
    return null;
  }

  // ── Price formatter: USD-only for EN, THB-only for TH ──
  var isEN = window.location.pathname.indexOf('/th/') === -1;
  function formatPrice(thb, usd) {
    if (isEN) return '$' + Math.round(usd);
    return '\u0E3F' + thb.toLocaleString();
  }

  // ── Update price from standard size ──
  function updateStandardPrice() {
    if (!sizeSelect || !priceDisplay) return;
    var val = sizeSelect.value;
    if (val === 'custom') {
      if (customDims) customDims.classList.add('open');
      if (addToCartBtn) addToCartBtn.disabled = true;
      priceDisplay.textContent = '—';
      return;
    }
    var dims = parseSizeVal(val);
    if (!dims) {
      priceDisplay.textContent = '—';
      if (addToCartBtn) addToCartBtn.disabled = true;
      return;
    }
    if (customDims) customDims.classList.remove('open');
    var result;
    if (isEncasement) {
      result = calcEncasement(dims.w, dims.l, dims.d);
    } else if (isPillowProtector || isPillowcase) {
      if (dims.w > MAX_PILLOW || dims.l > MAX_PILLOW) {
        priceDisplay.textContent = 'Max 120cm';
        if (addToCartBtn) addToCartBtn.disabled = true;
        return;
      }
      result = isPillowProtector ? calcPillowProtector(dims.w, dims.l) : calcPillowcase(dims.w, dims.l, state.fabric, pillowVariant);
    } else if (isDuvet) {
      result = calcDuvet(dims.w, dims.l, state.fabric);
    } else if (isFlatSheet) {
      result = calcFlatSheet(dims.w, dims.l, dims.d, state.fabric);
    } else {
      result = calcFittedSheet(dims.w, dims.l, dims.d, state.fabric);
    }
    if (!isFlatSheet && !isDuvet && !isPillowProtector && !isPillowcase && dims.w > MAX_W) {
      priceDisplay.textContent = 'Custom quote — Co-Sleep size';
      if (addToCartBtn) addToCartBtn.disabled = true;
      return;
    }
    priceDisplay.textContent = formatPrice(result.thb, result.usd);
    if (addToCartBtn) addToCartBtn.disabled = false;
  }

  // ── Update price from custom dimensions ──
  function updateCustomPrice() {
    if (!customPrice) return;
    var w = parseFloat(dimW && dimW.value) || 0;
    var l = parseFloat(dimL && dimL.value) || 0;
    var d = (isDuvet || isPillowProtector || isPillowcase) ? 0 : (parseFloat(dimD && dimD.value) || 0);
    if (!w || !l || (!isDuvet && !isPillowProtector && !isPillowcase && !d)) {
      customPrice.textContent = '\u2014';
      return;
    }
    var wCm = w, lCm = l, dCm = d;
    if (state.unit === 'in') { wCm = inchToCm(w); lCm = inchToCm(l); dCm = inchToCm(d); }
    if (!isFlatSheet && !isDuvet && !isPillowProtector && !isPillowcase && wCm > MAX_W) {
      customPrice.textContent = 'Custom quote \u2014 Co-Sleep size';
      return;
    }
    if ((isPillowProtector || isPillowcase) && (wCm > MAX_PILLOW || lCm > MAX_PILLOW)) {
      customPrice.textContent = 'Max 120cm';
      return;
    }
    var result;
    if (isEncasement) {
      result = calcEncasement(wCm, lCm, dCm);
    } else if (isPillowProtector) {
      result = calcPillowProtector(wCm, lCm);
    } else if (isPillowcase) {
      result = calcPillowcase(wCm, lCm, state.fabric, pillowVariant);
    } else if (isDuvet) {
      result = calcDuvet(wCm, lCm, state.fabric);
    } else if (isFlatSheet) {
      result = calcFlatSheet(wCm, lCm, dCm, state.fabric);
    } else {
      result = calcFittedSheet(wCm, lCm, dCm, state.fabric);
    }
    state.quotePriceThb = result.thb;
    state.quotePriceUsd = result.usd;
    customPrice.textContent = formatPrice(result.thb, result.usd);
  }

  function updateAllPrices() {
    updateStandardPrice();
    updateCustomPrice();
  }

  // ── Fabric dropdown change ──
  if (fabricSelect) {
    fabricSelect.addEventListener('change', function () {
      state.fabric = fabricSelect.value;
      updateAllPrices();
    });
  }

  // ── Size dropdown change ──
  if (sizeSelect) {
    sizeSelect.addEventListener('change', function () {
      updateStandardPrice();
    });
  }

  // ── Custom dimension inputs ──
  if (dimW) dimW.addEventListener('input', updateCustomPrice);
  if (dimL) dimL.addEventListener('input', updateCustomPrice);
  if (dimD) dimD.addEventListener('input', updateCustomPrice);

  // ── Unit toggle ──
  if (unitCmBtn) {
    unitCmBtn.addEventListener('click', function () {
      if (state.unit === 'cm') return;
      state.unit = 'cm';
      unitCmBtn.classList.add('active');
      if (unitInBtn) unitInBtn.classList.remove('active');
      // Convert inch → cm
      if (dimW && dimW.value) dimW.value = (inchToCm(parseFloat(dimW.value))).toFixed(1);
      if (dimL && dimL.value) dimL.value = (inchToCm(parseFloat(dimL.value))).toFixed(1);
      if (dimD && dimD.value) dimD.value = (inchToCm(parseFloat(dimD.value))).toFixed(1);
      updateCustomPrice();
    });
  }
  if (unitInBtn) {
    unitInBtn.addEventListener('click', function () {
      if (state.unit === 'in') return;
      state.unit = 'in';
      unitInBtn.classList.add('active');
      if (unitCmBtn) unitCmBtn.classList.remove('active');
      // Convert cm → inch
      if (dimW && dimW.value) dimW.value = (cmToInch(parseFloat(dimW.value))).toFixed(1);
      if (dimL && dimL.value) dimL.value = (cmToInch(parseFloat(dimL.value))).toFixed(1);
      if (dimD && dimD.value) dimD.value = (cmToInch(parseFloat(dimD.value))).toFixed(1);
      updateCustomPrice();
    });
  }

  // ── Custom quote toggle (existing — unchanged) ──
  if (customQuoteBtn) {
    customQuoteBtn.addEventListener('click', function () {
      if (customDims) customDims.classList.toggle('open');
    });
  }

  // ── "Custom Quote" button → validate dimensions then open popup ──
  var quoteOverlay = document.getElementById('quote-overlay');
  var confirmOverlay = document.getElementById('confirm-overlay');

  var submitQuoteBtn = document.getElementById('submit-custom-quote');
  if (submitQuoteBtn) {
    submitQuoteBtn.addEventListener('click', function (e) {
      e.preventDefault();

      // Validate dimensions are filled before showing popup
      var w = parseFloat(dimW && dimW.value) || 0;
      var l = parseFloat(dimL && dimL.value) || 0;
      var d = (isDuvet || isPillowProtector || isPillowcase) ? 0 : (parseFloat(dimD && dimD.value) || 0);
      if (state.unit === 'in') { w = inchToCm(w); l = inchToCm(l); d = inchToCm(d); }
      var dimValid = (isDuvet || isPillowProtector || isPillowcase) ? (w > 0 && l > 0) : (w > 0 && l > 0 && d > 0);
      if (!dimValid) {
        if (customDims && !customDims.classList.contains('open')) {
          customDims.classList.add('open');
        }
        alert((isDuvet || isPillowProtector || isPillowcase)
          ? 'Please enter your dimensions (Width, Length) before requesting a quote.'
          : 'Please enter your mattress dimensions (Width, Length, Depth) before requesting a quote.');
        if (dimW) dimW.focus();
        return;
      }

      quoteOverlay.classList.add('open');
      document.getElementById('qf-name').focus();
    });
  }

  // ── Close popups ──
  document.getElementById('quote-close').addEventListener('click', function () {
    quoteOverlay.classList.remove('open');
  });
  document.getElementById('confirm-close').addEventListener('click', function () {
    confirmOverlay.classList.remove('open');
  });
  document.getElementById('confirm-ok').addEventListener('click', function () {
    confirmOverlay.classList.remove('open');
  });
  quoteOverlay.addEventListener('click', function (e) {
    if (e.target === quoteOverlay) quoteOverlay.classList.remove('open');
  });
  confirmOverlay.addEventListener('click', function (e) {
    if (e.target === confirmOverlay) confirmOverlay.classList.remove('open');
  });

  // ── Form submit → POST /api/quote ──
  document.getElementById('quote-form').addEventListener('submit', function (e) {
    e.preventDefault();

    var qfName = document.getElementById('qf-name');
    var qfEmail = document.getElementById('qf-email');
    var name = qfName.value.trim();
    var email = qfEmail.value.trim();
    var errName = document.getElementById('qf-name-err');
    var errEmail = document.getElementById('qf-email-err');
    var valid = true;

    errName.classList.remove('show');
    errEmail.classList.remove('show');
    if (!name) { errName.textContent = 'Please enter your name'; errName.classList.add('show'); valid = false; }
    if (!email || email.indexOf('@') === -1) { errEmail.textContent = 'Please enter a valid email'; errEmail.classList.add('show'); valid = false; }
    if (!valid) return;

    // Collect dimensions
    var wCm = 0, lCm = 0, dCm = 0, dimDisplay = '';
    if (dimW && dimL) {
      wCm = parseFloat(dimW.value) || 0;
      lCm = parseFloat(dimL.value) || 0;
      dCm = (isDuvet || isPillowProtector || isPillowcase || !dimD) ? 0 : (parseFloat(dimD.value) || 0);
      if (state.unit === 'in') { wCm = inchToCm(wCm); lCm = inchToCm(lCm); dCm = inchToCm(dCm); }
    }

    var dimsValid = (isDuvet || isPillowProtector || isPillowcase) ? (wCm > 0 && lCm > 0) : (wCm > 0 && lCm > 0 && dCm > 0);
    if (!dimsValid) {
      document.getElementById('qf-submit').disabled = false;
      document.getElementById('qf-submit').textContent = 'Submit';
      if (customDims && !customDims.classList.contains('open')) {
        customDims.classList.add('open');
      }
      alert((isDuvet || isPillowProtector || isPillowcase)
        ? 'Please enter your dimensions (W \u00D7 L) before submitting the quote.'
        : 'Please enter your mattress dimensions (W \u00D7 L \u00D7 D) before submitting the quote. Click "Custom Size" first.');
      return;
    }
    dimDisplay = (isDuvet || isPillowProtector || isPillowcase)
      ? Math.round(wCm) + ' \u00D7 ' + Math.round(lCm) + ' cm'
      : Math.round(wCm) + ' \u00D7 ' + Math.round(lCm) + ' \u00D7 ' + Math.round(dCm) + ' cm';

    var fabricName = (fabricSelect && fabricSelect.options[fabricSelect.selectedIndex])
      ? fabricSelect.options[fabricSelect.selectedIndex].text
      : state.fabric;

    var productSlug = window.location.pathname.split('/').filter(Boolean).slice(-1)[0] || 'fitted-sheet';

    var submitBtn = document.getElementById('qf-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        email: email,
        address: (document.getElementById('qf-address') ? document.getElementById('qf-address').value.trim() : '') || undefined,
        telephone: (document.getElementById('qf-phone') ? document.getElementById('qf-phone').value.trim() : '') || undefined,
        product_slug: productSlug,
        dimensions: { w: wCm, l: lCm, d: dCm, unit: 'cm' },
        fabric: state.fabric,
        color: document.querySelector('.color-option.selected') ? document.querySelector('.color-option.selected').getAttribute('data-color') : undefined,
        quoted_price_thb: state.quotePriceThb,
        quoted_price_usd: state.quotePriceUsd,
        _website: (document.querySelector('[name="_website"]') ? document.querySelector('[name="_website"]').value : '') || undefined
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';

      if (data.success) {
        quoteOverlay.classList.remove('open');
        document.getElementById('confirm-text').innerHTML =
          'We\'ll email <strong>' + esc(email) + '</strong> within 24 hours.';
        document.getElementById('confirm-details').innerHTML =
          '<strong>Dimension:</strong> ' + dimDisplay + '<br>' +
          '<strong>Fabric:</strong> ' + fabricName + '<br>' +
          '<strong>Quote ID:</strong> ' + data.quote_id;
        confirmOverlay.classList.add('open');
      } else {
        alert('Error: ' + (data.error || 'Something went wrong.'));
      }
    })
    .catch(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      alert('Network error. Please try again.');
    });
  });

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Add to cart (stub — Phase 5) ──
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', function () {
      addToCartBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Added!';
      addToCartBtn.style.background = '#16a34a';
      setTimeout(function () {
        addToCartBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Add to Cart';
        addToCartBtn.style.background = '';
        addToCartBtn.disabled = true;
      }, 2000);
    });
  }

  // ── Color selector ──
  var colorOptions = document.querySelectorAll('.color-option');
  colorOptions.forEach(function (c) {
    c.addEventListener('click', function () {
      colorOptions.forEach(function (o) { o.classList.remove('selected'); });
      c.classList.add('selected');
    });
  });

  // ── Product tabs ──
  var tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('open'); });
      btn.classList.add('active');
      var panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('open');
    });
  });

  // ── Gallery thumbnails ──
  document.querySelectorAll('.gallery-thumb').forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      document.querySelectorAll('.gallery-thumb').forEach(function (t) { t.classList.remove('active'); });
      thumb.classList.add('active');
      var img = document.getElementById('gallery-main-img');
      if (img) img.src = thumb.dataset.img;
    });
  });

  // ── Init: default price ──
  updateAllPrices();
})();
