/* ============================================
   MildMate Product Configurator — Phase 4+
   Fitted sheet real pricing formula
   Hybrid: standard size presets + custom W—L—D
   Applies to: standard-fitted-sheet, deep-pocket-fitted-sheet, dorm-fitted-sheet, rv-truck-fitted-sheet
   ============================================ */

(async function () {
  // -- Detect product variant --
  var path = window.location.pathname;
  var isRVTruck = path.indexOf('rv-truck') !== -1;
  var isFlatSheet = path.indexOf('flat-sheet') !== -1;
  var isEncasement = path.indexOf('encasement') !== -1;
  var isPetOwner = path.indexOf('pet-owner') !== -1;
  var isFamily = path.indexOf('family-fitted-sheet') !== -1;
  var isDuvet = path.indexOf('duvet') !== -1;
  var isPillowProtector = path.indexOf('pillow-protector') !== -1;
  var isMattressProtector = (path.indexOf('mattress-protector') !== -1 || path.indexOf('pet-proof-mattress-protector') !== -1) && path.indexOf('pillow-protector') === -1;
  var isProtectorStandard = path.indexOf('mattress-protector-standard') !== -1;
  var isProtectorFamily = path.indexOf('mattress-protector-family') !== -1;
  var isProtectorDeepPocket = path.indexOf('mattress-protector-deep-pocket') !== -1;
  var isProtectorPetProof = path.indexOf('pet-proof-mattress-protector') !== -1;
  var isPillowcase = path.indexOf('pillowcase') !== -1;
  var isMarineFitted = path.indexOf('marine-fitted-sheet') !== -1;
  var pillowVariant = 'envelope';
  if (isPillowcase) {
    if (path.indexOf('zipper') !== -1) pillowVariant = 'zipper';
    else if (path.indexOf('sham') !== -1) pillowVariant = 'sham';
  }

  // -- Fetch dynamic pricing params from API (with hardcoded fallback) --
  var apiParams = null;
  try {
    var resp = await fetch('/api/pricing-params');
    if (resp.ok) apiParams = await resp.json();
  } catch(e) { /* offline/local — check sandbox */ }

  // Sandbox localStorage fallback: Super Admin changes flow to product pages
  if (!apiParams) {
    try {
      var sb = localStorage.getItem("sandbox_params");
      if (sb) {
        var sa = JSON.parse(sb);
        apiParams = { fixed_costs: {}, fabric_rates: {}, margins: {}, sewing_tiers: [], duvet_sewing_tiers: [] };
        sa.forEach(function(p) {
          if (p.category === "margin") apiParams.margins[p.key] = p.value;
          else if (p.key.indexOf("sewing_tier") === 0) apiParams.sewing_tiers.push({max:9999999,cost:p.value});
          else if (p.key.indexOf("duvet_tier") === 0) apiParams.duvet_sewing_tiers.push({max:9999999,cost:p.value});
          else if (p.key.indexOf("fabric_rate_") === 0) apiParams.fabric_rates[p.key.replace("fabric_rate_","")] = p.value;
          else apiParams.fixed_costs[p.key] = p.value;
        });
      }
    } catch(e2) {}
  }

  function pVal(key, fallback) {
    if (apiParams && apiParams.fixed_costs && apiParams.fixed_costs[key] !== undefined)
      return apiParams.fixed_costs[key];
    if (apiParams && apiParams.fabric_rates && apiParams.fabric_rates[key] !== undefined)
      return apiParams.fabric_rates[key];
    if (apiParams && apiParams.margins && apiParams.margins[key] !== undefined)
      return apiParams.margins[key];
    return fallback;
  }

  // pctVal: same as pVal but divides by 100 — for params stored as integer %
  function pctVal(key, fallback) {
    return pVal(key, fallback) / 100;
  }

  // -- Pricing constants (from API or hardcoded fallbacks) --
  var SQCM_PER_YARD = pVal('sqcm_per_yard', 23744);
  var PACKING = pVal('packing_cost', 100);
  var DELIVERY = pVal('delivery_cost', 50);
  var OP_RATE = pctVal('ops_rate', 15);
  var MKT_RATE = pctVal('mkt_rate', 20);
  var WASTE_FABRIC = 1 + pVal('waste_factor_fabric', 20) / 100;
  var ACCESSORIES_RATE = pctVal('accessories_rate', 10);
  var MARGIN_RATE = isMarineFitted ? pctVal('marine', 680)
    : isRVTruck ? pctVal('rv_truck', 45)
    : isFamily ? pctVal('family', 50)
    : isEncasement ? pctVal('encasement', 50)
    : isDuvet ? pctVal('duvet', 30)
    : isPillowcase ? pctVal('pillow', 15)
    : isPillowProtector ? pctVal('pillow_protector', 35)
    : isMattressProtector ? (
        isProtectorFamily ? pctVal('protector_family', 50)
        : isProtectorDeepPocket ? pctVal('protector_deep', 25)
        : pctVal('protector_standard', 15)
      )
    : pctVal('standard', 30);
  var MARKUP = 1 + OP_RATE + MKT_RATE + MARGIN_RATE;
  var THB_TO_USD = pVal('exchange_usd', 30);   // default: 1/rate_per_thb for USD

  // Fetch exchange rates from API
  var EXCHANGE_RATES = null;
  if (apiParams && apiParams.exchange_rates) {
    EXCHANGE_RATES = {};
    for (var i = 0; i < apiParams.exchange_rates.length; i++) {
      var er = apiParams.exchange_rates[i];
      EXCHANGE_RATES[er.currency] = 1 / er.rate_per_thb; // THB ? currency
    }
  }

  var MAX_W = isFamily ? 9999 : pVal('max_width_cm', 220);

  var FABRIC_RATES = {
    cloudsoft: pVal('cloudsoft', 100),
    breezeplus: pVal('breezeplus', 180),
    premacotton: pVal('premacotton', 180),
    ecoluxe: pVal('ecoluxe', 180)
  };

  // -- Sewing tiers (from API or fallback) --
  var SEWING_TIERS = [];
  if (apiParams && apiParams.sewing_tiers && apiParams.sewing_tiers.length) {
    SEWING_TIERS = apiParams.sewing_tiers;
  } else {
    SEWING_TIERS = [
      { max: 51600, cost: 120 },
      { max: 71000, cost: 200 },
      { max: 91200, cost: 300 },
      { max: 120000, cost: 400 },
      { max: Infinity, cost: 500 }
    ];
  }

  var DUVET_SEWING_TIERS = [];
  if (apiParams && apiParams.duvet_sewing_tiers && apiParams.duvet_sewing_tiers.length) {
    DUVET_SEWING_TIERS = apiParams.duvet_sewing_tiers;
  } else {
    DUVET_SEWING_TIERS = [
      { max: 98000, cost: 300 },
      { max: 139000, cost: 400 },
      { max: 170000, cost: 500 },
      { max: Infinity, cost: 600 }
    ];
  }

  // -- Pillow constants --
  var PILLOW_WASTE = 1 + pVal('waste_factor_pillowcase', 60) / 100;
  var PILLOW_SEWING = pVal('pillow_sewing_cost', 40);
  var SHAM_SEWING = pVal('pillow_sham_sewing_cost', 50);
  var MAX_PILLOW = pVal('max_pillow_cm', 120);
  var TPU_COST_PER_SQCM = (pVal('fabric_rate_tpu', 120) / pVal('tpu_sqcm_per_lm', 21000));

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

  // -- Flat sheet constants --
  var FLAT_TUCK = pVal('flat_tuck_cm', 25);
  var FLAT_SEWING = pVal('flat_sewing_cost', 250);

  // -- Encasement constants (TPU) --
  var TPU_COST_PER_LM = pVal('fabric_rate_tpu', 120);
  var TPU_BOLT_W = pVal('tpu_bolt_width_cm', 210);
  var TPU_SQCM_PER_LM = 100 * TPU_BOLT_W;
  var ENC_SEWING = pVal('encasement_sewing_cost', 300);
  var ZIPPER_RATE = pVal('zipper_rate', 0.4);
  var ENC_OP = OP_RATE;
  var ENC_MKT = pctVal('encasement_mkt', 25);
  var ENC_MARGIN = pctVal('encasement', 50);
  var ENC_MARKUP = 1 + ENC_OP + ENC_MKT + ENC_MARGIN;

  // -- Mattress Protector constants --
  // Fabric tier cost based on W—L area in sq.inch
  var PROTECTOR_FABRIC_TIERS = [
    { maxSqInch: 3200, cost: 550 },
    { maxSqInch: 6620, cost: 670 },
    { maxSqInch: 8000, cost: 920 },
    { maxSqInch: 9000, cost: 980 },
    { maxSqInch: 10300, cost: 1100 },
    { maxSqInch: 11300, cost: 1200 },
    { maxSqInch: Infinity, cost: 1300 }
  ];
  var PROTECTOR_PACKING = pVal('protector_packing', 200);
  var PROTECTOR_DELIVERY = pVal('protector_delivery', 80);
  var PROTECTOR_OP = OP_RATE;
  var PROTECTOR_MKT = MKT_RATE;
  var SQCM_PER_SQINCH = 6.4516;
  var PROTECTOR_MAX_DIM = 210;   // max W/L cm for non-family

  function getProtectorFabricCost(areaSqInch) {
    for (var i = 0; i < PROTECTOR_FABRIC_TIERS.length; i++) {
      if (areaSqInch <= PROTECTOR_FABRIC_TIERS[i].maxSqInch) return PROTECTOR_FABRIC_TIERS[i].cost;
    }
    return 1300;
  }

  function getProtectorDepthCost(dCm) {
    if (dCm > 56) return 600;
    if (dCm >= 52) return 400;
    if (dCm >= 30) return 200;
    return 0;
  }

  function calcMattressProtector(wCm, lCm, dCm) {
    var areaSqCm = wCm * lCm;
    var areaSqInch = areaSqCm / SQCM_PER_SQINCH;
    var fabricCost = getProtectorFabricCost(areaSqInch);
    var depthCost = getProtectorDepthCost(dCm);
    var protectorMargin = MARGIN_RATE;
    var markup = 1 + PROTECTOR_OP + PROTECTOR_MKT + protectorMargin;
    var subtotal = fabricCost + depthCost + PROTECTOR_PACKING + PROTECTOR_DELIVERY;
    var total = subtotal * markup;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd };
  }

  function calcEncasement(wCm, lCm, dCm) {
    // 6-sided surface area
    var area = 2 * (wCm * lCm + wCm * dCm + lCm * dCm);
    // TPU fabric cost
    var fabricCost = (TPU_COST_PER_LM * area / TPU_SQCM_PER_LM) * WASTE_FABRIC;
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
    // 2 pieces — (W+5) — (L+5) — 5cm sewing allowance on each edge, +20% waste
    var rawArea = 2 * (wCm + 5) * (lCm + 5);
    var area = rawArea * WASTE_FABRIC;
    var yardRate = FABRIC_RATES[fabric] || 100;
    var fabricCost = (area * yardRate / SQCM_PER_YARD);
    // Zipper: 0.4 THB/cm — (2L + W)
    var zipperCost = ZIPPER_RATE * (2 * lCm + wCm);
    var sewingCost = getDuvetSewingCost(rawArea);
    var subtotal = fabricCost + zipperCost + sewingCost + PACKING + DELIVERY;
    var total = subtotal * MARKUP;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100 };
  }

  function calcPillowProtector(wCm, lCm) {
    // 2 pieces — (W+5) — (L+5) + 60% waste, TPU fabric
    var rawArea = 2 * (wCm + 5) * (lCm + 5);
    var area = rawArea * PILLOW_WASTE;
    // TPU fabric cost: 120 THB/lm, 210cm bolt
    var fabricCost = area * TPU_COST_PER_SQCM;
    // Zipper: 0.4 THB/cm on longest side
    var zipperCost = ZIPPER_RATE * Math.max(wCm, lCm);
    var sewingCost = PILLOW_SEWING;
    var subtotal = fabricCost + zipperCost + sewingCost + PACKING + DELIVERY;
    var total = subtotal * MARKUP;
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
    var zipperCost = variant === 'zipper' ? ZIPPER_RATE * Math.max(wCm, lCm) : 0;
    var sewingCost = variant === 'sham' ? SHAM_SEWING : PILLOW_SEWING;
    var subtotal = fabricCost + zipperCost + sewingCost + PACKING + DELIVERY;
    var total = subtotal * MARKUP;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100 };
  }

  function calcFlatSheet(wCm, lCm, dCm, fabric) {
    var fw = wCm + 2 * dCm + FLAT_TUCK * 2;
    var fl = lCm + 2 * dCm + FLAT_TUCK * 2;
    var area = fw * fl;
    var yardRate = FABRIC_RATES[fabric] || 100;
    var fabricCost = (area * yardRate / SQCM_PER_YARD) * WASTE_FABRIC;
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
    var fabricCost = (area * yardRate / SQCM_PER_YARD) * WASTE_FABRIC;
    var sewingCost = getSewingCost(area);
    var accessories = fabricCost * ACCESSORIES_RATE;
    var subtotal = fabricCost + sewingCost + accessories + PACKING + DELIVERY;
    var total = subtotal * MARKUP;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100, fw: fw, fl: fl };
  }

  // V-Berth fitted sheet: uses max(HW,FW) as width, 100% margin
  var VERTH_MARKUP = 1 + OP_RATE + MKT_RATE + MARGIN_RATE; // uses marine margin from API
  function calcVBerthFitted(hwCm, fwCm, lCm, dCm, fabric) {
    var w = Math.max(hwCm, fwCm) + 2 * dCm + 14;
    var fl = lCm + 2 * dCm + 14;
    var area = w * fl;
    var yardRate = FABRIC_RATES[fabric] || 100;
    var fabricCost = (area * yardRate / SQCM_PER_YARD) * WASTE_FABRIC;
    var sewingCost = getSewingCost(area);
    var accessories = fabricCost * ACCESSORIES_RATE;
    var subtotal = fabricCost + sewingCost + accessories + PACKING + DELIVERY;
    var total = subtotal * VERTH_MARKUP;
    var rounded = Math.ceil(total / 100) * 100;
    var usd = Math.round((rounded / THB_TO_USD) * 100) / 100;
    return { thb: rounded, usd: usd, area: Math.round(area * 100) / 100, fw: w, fl: fl };
  }

  function inchToCm(v) { return v * 2.54; }
  function cmToInch(v) { return v * 0.393701; }

  // -- DOM refs --
  var sizeSelect = document.getElementById('size-select');
  var fabricSelect = document.getElementById('fabric-select');
  var priceDisplay = document.getElementById('price-display');
  var priceDisplayTop = document.getElementById('price-display-top');
  // Auto-sync price summary block (top of page) whenever configurator price updates
  if (priceDisplay && priceDisplayTop) {
    new MutationObserver(function() {
      priceDisplayTop.innerHTML = priceDisplay.innerHTML;
    }).observe(priceDisplay, { characterData: true, childList: true, subtree: true });
  }
  var addToCartBtn = document.getElementById('add-to-cart');
  var customPrice = document.getElementById('custom-price');

  // Tab switching — Standard Sizes vs Custom Quote
  var configTabs = document.querySelectorAll('.config-tab');
  var tabStandard = document.getElementById('tab-standard');
  var tabCustom = document.getElementById('tab-custom');
  function switchToTab(name) {
    configTabs.forEach(function(t) { t.classList.toggle('active', t.dataset.tab === name); });
    document.querySelectorAll('.config-tab-content').forEach(function(c) { c.classList.toggle('active', c.id === 'tab-' + name); });
    if (name === 'standard') switchToStandard();
    else switchToCustom();
  }
  configTabs.forEach(function(tab) {
    tab.addEventListener('click', function() { switchToTab(this.dataset.tab); });
  });
  function switchToStandard() {
    if (addToCartBtn) {
      addToCartBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Add to Cart';
      addToCartBtn.style.background = '';
      addToCartBtn.style.color = '';
    }
    validateForm();
  }
  function switchToCustom() {
    if (addToCartBtn) {
      addToCartBtn.innerHTML = 'Request Custom Quote';
      addToCartBtn.disabled = false;
      addToCartBtn.style.background = '#f59e0b';
      addToCartBtn.style.color = '#fff';
    }
    validateForm();
  }
  // Helper for focusing first dim input after switching to custom tab
  var dimFirstInput = null;
  function focusFirstDimInput() {
    if (!dimFirstInput) dimFirstInput = document.querySelector('#tab-custom input[type="number"]');
    if (dimFirstInput) { setTimeout(function() { dimFirstInput.focus(); }, 100); }
  }

  // Custom dimension inputs
  var dimW = document.getElementById('dim-width');
  var dimL = document.getElementById('dim-length');
  var dimD = document.getElementById('dim-depth');
  var dimFootW = document.getElementById('dim-foot-width');
  var unitCmBtn = document.getElementById('unit-cm');
  var unitInBtn = document.getElementById('unit-in');

  var state = {
    unit: 'cm',
    fabric: 'cloudsoft',
    region: '',   // selected region chip — gates size dropdown
    quotePriceThb: 0,
    quotePriceUsd: 0
  };

  if (!fabricSelect && !sizeSelect) return; // Not a configurator page — exit

  // Initially disable Add to Cart until all required fields are selected
  if (addToCartBtn) addToCartBtn.disabled = true;

  // Inject validation notice bar
  (function injectValidationNotice() {
    var panel = document.querySelector('.pricing-panel');
    if (!panel) return;
    var notice = document.createElement('div');
    notice.id = 'validation-notice';
    notice.className = 'validation-notice';
    notice.setAttribute('aria-live', 'polite');
    panel.insertAdjacentElement('beforebegin', notice);
  })();

  // -- Validation: gate Add to Cart until required fields are selected --
  function getValidation() {
    var noColorSwatches = document.querySelectorAll('.fabric-color-group').length === 0;
    var hasColorSwatches = document.querySelectorAll('.color-option').length > 0;
    var activeGroup = document.querySelector('.fabric-color-group[data-fabric="' + state.fabric + '"]');
    var hasSelectedColor = activeGroup ? !!activeGroup.querySelector('.color-option.selected') : false;
    var isPetOwnerOrMarine = isPetOwner || isMarineFitted;
    var noColorRequired = isPetOwnerOrMarine || noColorSwatches;
    // Marine: shape select IS the size/region selector — region always passes
    var noRegionRequired = isMarineFitted;

    return {
      region: noRegionRequired || !!state.region,
      size: !!sizeSelect && sizeSelect.value !== '' && sizeSelect.value !== 'custom',
      fabric: !!state.fabric,
      color: noColorRequired || (hasColorSwatches && hasSelectedColor)
    };
  }

  function validateForm() {
    var v = getValidation();
    var allMissing = [];
    if (!v.region) allMissing.push('Country / Region');
    if (!v.size) allMissing.push('Size');
    if (!v.fabric) allMissing.push('Fabric');
    if (!v.color) allMissing.push('Color');

    // Show only the FIRST missing requirement (sequential guidance)
    var nextMissing = allMissing[0] || '';

    var notice = document.getElementById('validation-notice');
    if (notice) {
      if (nextMissing) {
        notice.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Please select: ' + nextMissing;
        notice.className = 'validation-notice visible';
        notice.style.display = 'flex';
      } else {
        notice.style.display = 'none';
        notice.className = 'validation-notice';
      }
    }

    // Update "Starting from" sub-label — hide when a valid selection is made
    var priceSub = document.getElementById('price-top-sub');
    if (priceSub) {
      priceSub.textContent = (v.region && v.size) ? '' : 'Starting from';
    }

    if (addToCartBtn) {
      addToCartBtn.disabled = !(v.region && v.size && v.fabric && v.color);
    }
  }

  if (isPetOwner) state.fabric = 'breezeplus'; // Pet Owner products: BreezePlus only
  if (isDuvet && path.indexOf('rv') !== -1) state.fabric = 'cloudsoft'; // RV & Truck duvet: CloudSoft only
  if (isDuvet && path.indexOf('marine') !== -1) state.fabric = 'cloudsoft'; // Marine duvet: CloudSoft only

  // Duvet covers & pillow protectors only need W—L — hide the depth input
  if ((isDuvet || isPillowProtector || isPillowcase) && dimD) {
    var dimDGroup = dimD.closest('.dim-field') || dimD.closest('.input-group');
    if (dimDGroup) dimDGroup.style.display = 'none';
  }

  // -- Marine Fitted Sheet — shape-based pricing --
  if (isMarineFitted) {
    state.fabric = 'cloudsoft';
    // Hide "Select Mattress Size" — marine uses "Choose Your Berth Shape" instead
    if (sizeSelect) {
      var sizeSection = sizeSelect.closest('.panel-section');
      if (sizeSection) sizeSection.style.display = 'none';
    }
    var shapeSelect = document.getElementById('marine-shape-select');
    var shapeHint = document.getElementById('shape-dims-hint');

    if (dimW) { var dimWLabel = dimW.parentElement.querySelector('label'); if (dimWLabel) dimWLabel.textContent = 'Head Width (HW)'; }
    if (dimL) {
      var dimLLabel = dimL.parentElement.querySelector('label');
      if (dimLLabel) {
        dimLLabel.innerHTML = 'Length (L) <span class="dim-tooltip"><span class="dim-tooltip-icon">i</span><span class="dim-tooltip-text"><strong>How to measure V-Berth Length:</strong> Run your tape measure flat down the exact middle of the mattress from the head to the foot at a right angle (90\u00B0). Measuring from corner to corner along the slanted outside edge will result in a mattress that is too short.</span></span>';
      }
    }

    if (shapeSelect) {
      shapeSelect.addEventListener('change', function () {
        var opt = shapeSelect.selectedOptions[0];
        if (!opt || !opt.value) {
          if (shapeHint) shapeHint.textContent = '';
          priceDisplay.textContent = 'Select shape above';
          state.region = '';
          validateForm();
          return;
        }
        var quoteOnly = opt.dataset.quoteOnly === '1';
        var lMin = opt.dataset.lengthMin, lMax = opt.dataset.lengthMax;
        var hMin = opt.dataset.headMin, hMax = opt.dataset.headMax;
        var fMin = opt.dataset.footMin, fMax = opt.dataset.footMax;

        // Price display
        if (quoteOnly) {
          priceDisplay.textContent = 'Custom Quote';
          if (addToCartBtn) { addToCartBtn.textContent = 'Request Quote'; addToCartBtn.style.background = '#f59e0b'; }
          state._dims = null;
          state._price = null;
        } else {
          var price = parseFloat(opt.dataset.price) || 0;
          var thb = Math.round(price * THB_TO_USD);
          priceDisplay.innerHTML = displayPrice(thb, price);
          if (addToCartBtn) { addToCartBtn.textContent = 'Add to Cart'; addToCartBtn.style.background = ''; }
          state._dims = { w: parseFloat(opt.dataset.headMin) || 0, l: parseFloat(opt.dataset.lengthMin) || 0, d: 30 };
          state._price = { thb: thb, usd: price };
          state.region = 'marine';  // Marine uses shape selector — mark region as set
          validateForm();
        }

        // Dimension hints
        if (shapeHint) {
          var parts = [];
          if (lMin) parts.push('L: ' + lMin + '\u2013' + lMax + ' cm');
          if (hMin) parts.push('HW: ' + hMin + '\u2013' + hMax + ' cm');
          if (fMin) parts.push('FW: ' + fMin + '\u2013' + fMax + ' cm');
          shapeHint.textContent = parts.length ? 'Valid range: ' + parts.join('  |  ') : 'Custom dimensions only — request a quote below';
        }
      });
    }
  }

  // -- Populate size-select from centralized size data --
  function populateSizeSelect() {
    if (!sizeSelect || typeof PRODUCT_SIZES === 'undefined') return;
    var typeKey = isDuvet ? 'duvet' : (isPillowcase || isPillowProtector) ? 'pillow' : 'fitted-sheet';
    var sizes = PRODUCT_SIZES[typeKey];
    if (!sizes) return;

    var regionLabels = { us: '\uD83C\uDDFA\uD83C\uDDF8 US / CA', uk: '\uD83C\uDDEC\uD83C\uDDE7 UK', eu: '\uD83C\uDDEA\uD83C\uDDFA EU', th: '\uD83C\uDDF9\uD83C\uDDED TH', au: '\uD83C\uDDE6\uD83C\uDDFA AU', my: '\uD83C\uDDF2\uD83C\uDDFE MY / SG', jp: '\uD83C\uDDEF\uD83C\uDDF5 JP', in: '\uD83C\uDDEE\uD83C\uDDF3 IN' };
    sizeSelect.innerHTML = '<option value="">\u2014 Choose size \u2014</option>';

    for (var region in sizes) {
      if (!sizes.hasOwnProperty(region)) continue;
      var items = sizes[region];
      var label = regionLabels[region] || region.toUpperCase();
      var optgroup = document.createElement('optgroup');
      optgroup.label = label;
      optgroup.setAttribute('data-region', region);
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
    enhanceSizeSelect(sizeSelect);
  }
  populateSizeSelect();

  function escHTML(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function enhanceSizeSelect(selectEl) {
    if (!selectEl || !selectEl.id) return;
    var host = selectEl.parentElement;
    if (!host) return;

    var groups = [];
    Array.prototype.forEach.call(selectEl.children, function (node) {
      if (!node || node.tagName !== 'OPTGROUP') return;
      var options = [];
      Array.prototype.forEach.call(node.children, function (opt) {
        if (!opt.value) return;
        options.push({ value: opt.value, label: opt.textContent });
      });
      if (!options.length) return;
      groups.push({
        code: node.getAttribute('data-region') || '',
        label: node.label || '',
        options: options
      });
    });

    if (!groups.length) {
      enhanceSelectToPills(selectEl);
      return;
    }

    var picker = host.querySelector('.size-picker[data-select-id="' + selectEl.id + '"]');
    if (!picker) {
      picker = document.createElement('div');
      picker.className = 'size-picker';
      picker.setAttribute('data-select-id', selectEl.id);
      selectEl.insertAdjacentElement('afterend', picker);
    }

    var activeIndex = 0;
    var showAllByIndex = [];
    for (var i = 0; i < groups.length; i++) showAllByIndex.push(false);

    function syncActiveIndexByValue(value) {
      if (!value) return;
      // Try current region first, then others
      var regions = [activeIndex];
      for (var i = 0; i < groups.length; i++) {
        if (i !== activeIndex) regions.push(i);
      }
      for (var ri = 0; ri < regions.length; ri++) {
        var gi = regions[ri];
        for (var oi = 0; oi < groups[gi].options.length; oi++) {
          if (groups[gi].options[oi].value === value) {
            activeIndex = gi;
            return;
          }
        }
      }
    }

    function renderSizePicker() {
      var active = groups[activeIndex] || groups[0];
      if (!active) return;

      var chipsHTML = groups.map(function (group, idx) {
        return '<button type="button" class="size-country-chip' + (idx === activeIndex ? ' active' : '') + '" data-idx="' + idx + '">' + escHTML(group.label) + '</button>';
      }).join('');

      var showAll = showAllByIndex[activeIndex];
      var visibleOptions = showAll ? active.options : active.options.slice(0, 6);
      var optionsHTML = visibleOptions.map(function (opt) {
        return (
          '<button type="button" class="selection-pill size-option-pill' + (opt.value === selectEl.value ? ' active' : '') + '" data-value="' + escHTML(opt.value) + '">' +
            '<span class="selection-pill-label">' + escHTML(opt.label) + '</span>' +
          '</button>'
        );
      }).join('');

      var toggleHTML = '';
      if (active.options.length > 6) {
        toggleHTML = '<button type="button" class="size-toggle-btn" data-action="toggle-all">' + (showAll ? 'Show fewer sizes' : ('See all sizes (' + active.options.length + ')')) + '</button>';
      }

      picker.innerHTML = '' +
        '<div class="size-country-chips">' + chipsHTML + '</div>' +
        '<div class="size-options-grid">' + optionsHTML + '</div>' +
        toggleHTML;

      Array.prototype.forEach.call(picker.querySelectorAll('.size-country-chip'), function (chip) {
        chip.addEventListener('click', function () {
          var newIdx = parseInt(chip.getAttribute('data-idx'), 10) || 0;
          if (newIdx === activeIndex) return;
          activeIndex = newIdx;
          state.region = groups[newIdx] && groups[newIdx].code || '';
          selectEl.value = '';  // reset — prevent cross-region value bleed
          validateForm();
          renderSizePicker();
        });
      });

      Array.prototype.forEach.call(picker.querySelectorAll('.size-option-pill'), function (pill) {
        pill.addEventListener('click', function () {
          var value = pill.getAttribute('data-value');
          if (!value || selectEl.value === value) return;
          selectEl.value = value;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          validateForm();
        });
      });

      var toggleBtn = picker.querySelector('.size-toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          showAllByIndex[activeIndex] = !showAllByIndex[activeIndex];
          renderSizePicker();
        });
      }
    }

    if (!selectEl.dataset.sizePickerSyncBound) {
      selectEl.addEventListener('change', function () {
        syncActiveIndexByValue(selectEl.value);
        renderSizePicker();
        validateForm();
      });
      selectEl.dataset.sizePickerSyncBound = '1';
    }

    syncActiveIndexByValue(selectEl.value);
    // Auto-select US/CA (first region) and its first size on initial load
    if (!selectEl.value && groups.length > 0 && groups[0].options.length > 0) {
      activeIndex = 0;
      var firstOpt = groups[0].options[0];
      state.region = groups[0].code || '';
      selectEl.value = firstOpt.value;
    } else if (selectEl.value && groups[activeIndex]) {
      state.region = groups[activeIndex].code || '';
    }
    selectEl.classList.add('sr-select');
    renderSizePicker();
    // Trigger price update for auto-selected first size
    if (selectEl.value) {
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      validateForm();
    }
  }

  function syncPillState(selectEl, pillsWrap) {
    if (!selectEl || !pillsWrap) return;
    var selected = selectEl.value;
    pillsWrap.querySelectorAll('.selection-pill').forEach(function (pill) {
      pill.classList.toggle('active', pill.getAttribute('data-value') === selected);
    });
  }

  function enhanceSelectToPills(selectEl) {
    if (!selectEl || !selectEl.id) return;
    var host = selectEl.parentElement;
    if (!host) return;

    var options = [];
    Array.prototype.forEach.call(selectEl.options, function (opt) {
      if (!opt.value || opt.hidden) return;
      var grp = (opt.parentElement && opt.parentElement.tagName === 'OPTGROUP') ? opt.parentElement.label : '';
      options.push({ value: opt.value, label: opt.textContent, group: grp });
    });

    var pillsWrap = host.querySelector('.selection-pills[data-select-id="' + selectEl.id + '"]');
    if (!pillsWrap) {
      pillsWrap = document.createElement('div');
      pillsWrap.className = 'selection-pills';
      pillsWrap.setAttribute('data-select-id', selectEl.id);
      selectEl.insertAdjacentElement('afterend', pillsWrap);
    }

    pillsWrap.innerHTML = options.map(function (opt) {
      return (
        '<button type="button" class="selection-pill" data-value="' + escHTML(opt.value) + '">' +
          (opt.group ? ('<span class="selection-pill-group">' + escHTML(opt.group) + '</span>') : '') +
          '<span class="selection-pill-label">' + escHTML(opt.label) + '</span>' +
        '</button>'
      );
    }).join('');

    Array.prototype.forEach.call(pillsWrap.querySelectorAll('.selection-pill'), function (pill) {
      pill.addEventListener('click', function () {
        var nextVal = pill.getAttribute('data-value');
        if (selectEl.value === nextVal) return;
        selectEl.value = nextVal;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    if (!selectEl.dataset.pillSyncBound) {
      selectEl.addEventListener('change', function () { syncPillState(selectEl, pillsWrap); });
      selectEl.dataset.pillSyncBound = '1';
    }

    selectEl.classList.add('sr-select');
    syncPillState(selectEl, pillsWrap);
  }

  if (fabricSelect) enhanceSelectToPills(fabricSelect);
  if (isMarineFitted) {
    var marineShapeSelect = document.getElementById('marine-shape-select');
    if (marineShapeSelect) enhanceSelectToPills(marineShapeSelect);
  }

  // -- Inject quote popup HTML --
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

  // -- Parse "WxLxD" string from option value --
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

  // -- Price formatter: USD-only for EN, THB-only for TH --
  var isEN = window.location.pathname.indexOf('/th/') === -1;
  function formatPrice(thb, usd) {
    if (isEN) return '$' + Math.round(usd);
    return '\u0E3F' + thb.toLocaleString();
  }

  // -- Campaign discount helper --
  function applyCampaignDiscount(thb, usd) {
    var discount = 0;
    if (typeof MildMateCampaigns !== 'undefined') {
      var path = window.location.pathname;
      var slug = path.split('/').filter(function(s){return s;}).pop();
      discount = MildMateCampaigns.getDiscountForProduct(slug).discount || 0;
    }
    var dThb = Math.round(thb * (1 - discount / 100));
    var dUsd = Math.round((dThb / THB_TO_USD) * 100) / 100;
    return { thb: dThb, usd: dUsd, discount: discount, originalThb: thb, originalUsd: usd };
  }

  function updateSaleInfoDiv(discount, originalThb, originalUsd) {
    var el = document.getElementById('sale-info');
    if (!el) return;
    if (!discount) { el.innerHTML = ''; return; }
    var countdown = typeof MildMateCampaigns !== 'undefined' ? MildMateCampaigns.getCampaignCountdown(window.location.pathname.split('/').filter(function(s){return s;}).pop()) : null;
    var html = '<div class="sale-badge">-' + discount + '% SALE</div>';
    if (countdown) html += '<div class="sale-countdown">(' + countdown.days + 'd ' + countdown.hours + 'h ' + countdown.mins + 'm left)</div>';
    el.innerHTML = html;
  }

  function displayPrice(thb, usd, priceEl) {
    var result = applyCampaignDiscount(thb, usd);
    updateSaleInfoDiv(result.discount, result.originalThb, result.originalUsd);
    if (result.discount > 0) {
      return '<span class="price-strike">' + formatPrice(result.originalThb, result.originalUsd) + '</span><span class="price-sale">' + formatPrice(result.thb, result.usd) + '</span>';
    }
    return formatPrice(thb, usd);
  }

  // -- Update price from standard size --
  function updateStandardPrice() {
    if (!sizeSelect || !priceDisplay) return;
    // Marine has no standard size dropdown — pricing handled by shape selector + custom dims
    if (isMarineFitted) return;
    var val = sizeSelect.value;
    if (val === 'custom') {
      switchToTab('custom');
      focusFirstDimInput();
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
    // V-Berth: no standard-size dropdown — handled by "Choose Your Berth Shape" + custom dims

    var result;
    if (isEncasement) {
      result = calcEncasement(dims.w, dims.l, dims.d);
    } else if (isMattressProtector) {
      if (!isProtectorFamily && (dims.w > PROTECTOR_MAX_DIM || dims.l > PROTECTOR_MAX_DIM)) {
        priceDisplay.textContent = 'Over 210cm \u2014 see Family Protector';
        if (addToCartBtn) addToCartBtn.disabled = true;
        return;
      }
      result = calcMattressProtector(dims.w, dims.l, dims.d);
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
    if (!isFlatSheet && !isDuvet && !isPillowProtector && !isPillowcase && !isMattressProtector && dims.w > MAX_W) {
      priceDisplay.textContent = 'Custom quote — Co-Sleep size';
      if (addToCartBtn) addToCartBtn.disabled = true;
      return;
    }
    priceDisplay.innerHTML = displayPrice(result.thb, result.usd);
    validateForm();
    // Save for add-to-cart handler
    state._dims = dims;
    state._price = { thb: result.thb, usd: result.usd };
  }

  // -- Update price from custom dimensions --
  function updateCustomPrice() {
    if (!customPrice) return;
    var w = parseFloat(dimW && dimW.value) || 0;
    var l = parseFloat(dimL && dimL.value) || 0;
    var d = (isDuvet || isPillowProtector || isPillowcase) ? 0 : (parseFloat(dimD && dimD.value) || 0);
    if (!w || !l || (!isDuvet && !isPillowProtector && !isPillowcase && !d && !isMattressProtector)) {
      customPrice.textContent = '\u2014';
      return;
    }
    var wCm = w, lCm = l, dCm = d;
    if (state.unit === 'in') { wCm = inchToCm(w); lCm = inchToCm(l); dCm = inchToCm(d); }
    if (!isFlatSheet && !isDuvet && !isPillowProtector && !isPillowcase && !isMattressProtector && wCm > MAX_W) {
      customPrice.textContent = 'Custom quote \u2014 Co-Sleep size';
      return;
    }
    if ((isPillowProtector || isPillowcase) && (wCm > MAX_PILLOW || lCm > MAX_PILLOW)) {
      customPrice.textContent = 'Max 120cm';
      return;
    }

    // V-Berth fitted sheet: formula-based pricing
    if (isMarineFitted) {
      var dimFootW = document.getElementById('dim-foot-width');
      var fw = parseFloat(dimFootW && dimFootW.value) || 0;
      if (state.unit === 'in') fw = inchToCm(fw);
      if (fw <= 0) { customPrice.textContent = 'Enter Foot Width (FW)'; return; }
      if (!dCm) {
        // Default depth to 7 inches (17.78 cm) if user hasn't entered one, per spec
        dCm = state.unit === 'in' ? 7 : 17.78;
      }
      var result = calcVBerthFitted(wCm, fw, lCm, dCm, state.fabric);
      state.quotePriceThb = result.thb;
      state.quotePriceUsd = result.usd;
      customPrice.innerHTML = displayPrice(result.thb, result.usd);
      return;
    }

    var result;
    if (isEncasement) {
      result = calcEncasement(wCm, lCm, dCm);
    } else if (isMattressProtector) {
      if (!isProtectorFamily && (wCm > PROTECTOR_MAX_DIM || lCm > PROTECTOR_MAX_DIM)) {
        customPrice.textContent = 'Over 210cm \u2014 see Family Protector';
        return;
      }
      result = calcMattressProtector(wCm, lCm, dCm);
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
    customPrice.innerHTML = displayPrice(result.thb, result.usd);
  }

  function updateAllPrices() {
    updateStandardPrice();
    updateCustomPrice();
  }

  function formatColorName(raw) {
    var txt = String(raw || '').trim();
    if (!txt) return '';
    txt = txt.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    return txt.replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }

  function updateSelectedColorName(groupEl) {
    if (!groupEl) return;
    var selected = groupEl.querySelector('.color-option.selected') || groupEl.querySelector('.color-option');
    var label = groupEl.querySelector('.selected-color-name');
    if (!label) {
      label = document.createElement('div');
      label.className = 'selected-color-name';
      label.setAttribute('aria-live', 'polite');
      label.setAttribute('aria-atomic', 'true');
      groupEl.appendChild(label);
    }
    if (!selected) {
      label.textContent = '';
      return;
    }
    var rawName = selected.getAttribute('title') || selected.getAttribute('data-color') || '';
    label.textContent = 'Selected color: ' + formatColorName(rawName);
  }

  // -- Fabric dropdown change --
  if (fabricSelect) {
    fabricSelect.addEventListener('change', function () {
      state.fabric = fabricSelect.value;
      updateAllPrices();
      // Swap fabric color group
      var groups = document.querySelectorAll('.fabric-color-group');
      groups.forEach(function (g) {
        g.style.display = g.dataset.fabric === state.fabric ? '' : 'none';
      });
      // Reset selection to first color of the new fabric
      var activeGroup = document.querySelector('.fabric-color-group[data-fabric="' + state.fabric + '"]');
      if (activeGroup) {
        var opts = activeGroup.querySelectorAll('.color-option');
        opts.forEach(function (o) { o.classList.remove('selected'); });
        if (opts.length > 0) opts[0].classList.add('selected');
        updateSelectedColorName(activeGroup);
      }
      validateForm();
    });
  }

  // -- Size dropdown change --
  if (sizeSelect) {
    sizeSelect.addEventListener('change', function () {
      updateStandardPrice();
    });
  }

  // -- Custom dimension inputs --
  if (dimW) dimW.addEventListener('input', updateCustomPrice);
  if (dimL) dimL.addEventListener('input', updateCustomPrice);
  if (dimD) dimD.addEventListener('input', updateCustomPrice);

  // -- Unit toggle --
  if (unitCmBtn) {
    unitCmBtn.addEventListener('click', function () {
      if (state.unit === 'cm') return;
      state.unit = 'cm';
      unitCmBtn.classList.add('active');
      if (unitInBtn) unitInBtn.classList.remove('active');
      // Convert inch ? cm
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
      // Convert cm ? inch
      if (dimW && dimW.value) dimW.value = (cmToInch(parseFloat(dimW.value))).toFixed(1);
      if (dimL && dimL.value) dimL.value = (cmToInch(parseFloat(dimL.value))).toFixed(1);
      if (dimD && dimD.value) dimD.value = (cmToInch(parseFloat(dimD.value))).toFixed(1);
      updateCustomPrice();
    });
  }

  // -- "Custom Quote" button ? validate dimensions then open popup --
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
        switchToTab('custom');
        focusFirstDimInput();
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

  // -- Close popups --
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

  // -- Form submit ? POST /api/quote --
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
      switchToTab('custom');
      focusFirstDimInput();
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
        marine_shape: (function () {
          if (!isMarineFitted) return undefined;
          var sm = document.getElementById('marine-shape-select');
          var so = sm && sm.selectedOptions[0];
          return so && so.value ? { code: so.value, name: so.textContent.split('\u2014').slice(1).join('\u2014').split('(')[0].trim() } : undefined;
        })(),
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

  // -- Add to cart (Phase 5) --
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', function () {
      // If Custom Quote tab is active, trigger quote popup instead of add-to-cart
      if (tabCustom && tabCustom.classList.contains('active')) {
        var w = parseFloat(dimW && dimW.value) || 0;
        var l = parseFloat(dimL && dimL.value) || 0;
        var d = (isDuvet || isPillowProtector || isPillowcase) ? 0 : (parseFloat(dimD && dimD.value) || 0);
        if (state.unit === 'in') { w = inchToCm(w); l = inchToCm(l); d = inchToCm(d); }
        var dimValid = (isDuvet || isPillowProtector || isPillowcase) ? (w > 0 && l > 0) : (w > 0 && l > 0 && d > 0);
        if (!dimValid) {
          switchToTab('custom');
          focusFirstDimInput();
          alert((isDuvet || isPillowProtector || isPillowcase)
            ? 'Please enter your dimensions (Width, Length) before requesting a quote.'
            : 'Please enter your mattress dimensions (Width, Length, Depth) before requesting a quote.');
          return;
        }
        quoteOverlay.classList.add('open');
        var qfName = document.getElementById('qf-name');
        if (qfName) qfName.focus();
        return;
      }

      if (!state._dims || !state._price) return;

      var productSlug = window.location.pathname.split('/').filter(Boolean).slice(-1)[0] || 'fitted-sheet';
      var titleEl = document.querySelector('.product-title');
      var productName = titleEl ? titleEl.textContent.trim() : productSlug.replace(/-/g, ' ').replace(/\b\w/g, function(c){return c.toUpperCase();});

      var fabricName = (fabricSelect && fabricSelect.options[fabricSelect.selectedIndex])
        ? fabricSelect.options[fabricSelect.selectedIndex].text
        : state.fabric;

      // Color: look up within the active (visible) fabric group, format via title
      var activeColorGroup = document.querySelector('.fabric-color-group[data-fabric="' + state.fabric + '"]');
      var selectedColorEl = activeColorGroup ? activeColorGroup.querySelector('.color-option.selected') : null;
      var colorName = selectedColorEl ? formatColorName(selectedColorEl.getAttribute('title') || selectedColorEl.getAttribute('data-color') || '') : '';

      // Size label: capture the human-readable label (e.g., "US/CA · Twin 68×86″")
      var sizeLabel = '';
      if (sizeSelect && sizeSelect.selectedOptions[0] && sizeSelect.value && sizeSelect.value !== 'custom') {
        sizeLabel = sizeSelect.selectedOptions[0].text.trim();
      }
      if (isMarineFitted) {
        var ms = document.getElementById('marine-shape-select');
        if (ms && ms.selectedOptions[0] && ms.value) {
          sizeLabel = ms.selectedOptions[0].text.trim();
        }
      }

      var item = {
        type: 'product',
        id: 'cart-' + Date.now(),
        product_slug: productSlug,
        product_name: productName,
        dimensions: {
          w: state._dims.w,
          l: state._dims.l,
          d: state._dims.d || 0,
          unit: 'cm',
          label: sizeLabel
        },
        fabric: fabricName,
        color: colorName,
        price_usd: Math.round(state._price.usd),
        price_thb: state._price.thb,
        qty: 1,
        image: (function() {
          var meta = document.querySelector('meta[name="product-image"]');
          return meta ? meta.getAttribute('content') || meta.content : '';
        })()
      };

      if (window.MildMateCart) {
        window.MildMateCart.add(item);
      }

      // Visual feedback
      addToCartBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Added!';
      addToCartBtn.style.background = '#16a34a';
      setTimeout(function () {
        addToCartBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Add to Cart';
        addToCartBtn.style.background = '';
        addToCartBtn.disabled = false;
      }, 2000);
    });
  }

  // -- Color selector --
  var colorOptions = document.querySelectorAll('.color-option');
  colorOptions.forEach(function (c) {
    c.addEventListener('click', function () {
      var group = c.closest('.fabric-color-group');
      if (!group) return;
      group.querySelectorAll('.color-option').forEach(function (o) { o.classList.remove('selected'); });
      c.classList.add('selected');
      updateSelectedColorName(group);
      validateForm();
    });
  });
  document.querySelectorAll('.fabric-color-group').forEach(function (group) {
    updateSelectedColorName(group);
  });

  // -- Info tabs --
  var infoTabs = document.querySelectorAll('.info-tab');
  infoTabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tabName = btn.getAttribute('data-info-tab');
      infoTabs.forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.info-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var panel = document.getElementById('info-panel-' + tabName);
      if (panel) panel.classList.add('active');
    });
  });

  // -- Init: default price --
  updateAllPrices();
})();
