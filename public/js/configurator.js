/* ============================================
   MildMate Configurator — Phase 4
   Two-mode live price calculator + fabric tabs
   ============================================ */

(function () {
  const cfg = document.getElementById('configurator');
  if (cfg) {

  let state = {
    mode: 'sheet',
    unit: 'cm',
    fabric: 'breezeplus',
    values: {}
  };

  const FABRIC_RATES = {
    breezeplus: 0.0016,
    cloudsoft: 0.0014,
    premacotton: 0.0018,
    ecoluxe: 0.0020
  };

  const BASE_PRICES = {
    sheet: { usd: 45, thb: 1590 },
    vberth: { usd: 55, thb: 1945 }
  };

  const CM_TO_INCH = 0.393701;
  const INCH_TO_CM = 2.54;

  const tabs = cfg.querySelectorAll('.configurator-tab');
  const unitBtns = cfg.querySelectorAll('.unit-toggle button');
  const fabricChips = cfg.querySelectorAll('.fabric-chip');
  const inputsContainer = document.getElementById('configurator-inputs');
  const diagramContainer = document.getElementById('configurator-diagram');
  const priceDisplay = document.getElementById('configurator-price');
  const addBtn = document.getElementById('cfg-add-to-cart');

  function renderInputs() {
    if (!inputsContainer) return;
    if (state.mode === 'sheet') {
      inputsContainer.innerHTML = `
        <div class="input-group"><label for="cfg-width">Width (W)</label><input type="number" id="cfg-width" placeholder="e.g. 160" min="1" step="0.1"></div>
        <div class="input-group"><label for="cfg-length">Length (L)</label><input type="number" id="cfg-length" placeholder="e.g. 200" min="1" step="0.1"></div>
        <div class="input-group"><label for="cfg-depth">Depth / Pocket (D)</label><input type="number" id="cfg-depth" placeholder="e.g. 30" min="1" step="0.1"></div>
      `;
    } else {
      inputsContainer.innerHTML = `
        <div class="input-group"><label for="cfg-head">Head Width (Bow)</label><input type="number" id="cfg-head" placeholder="Narrow end" min="1" step="0.1"></div>
        <div class="input-group"><label for="cfg-foot">Foot Width (Cabin)</label><input type="number" id="cfg-foot" placeholder="Wide end" min="1" step="0.1"></div>
        <div class="input-group"><label for="cfg-length">Length (L)</label><input type="number" id="cfg-length" placeholder="Bow to stern" min="1" step="0.1"></div>
        <div class="input-group"><label for="cfg-depth">Depth / Pocket (D)</label><input type="number" id="cfg-depth" placeholder="Mattress thickness" min="1" step="0.1"></div>
      `;
    }
    inputsContainer.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', calculatePrice);
    });
  }

  function renderDiagram() {
    if (!diagramContainer) return;
    if (state.mode === 'sheet') {
      diagramContainer.innerHTML = `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="160" height="100" fill="none" stroke="#2c96f4" stroke-width="2" rx="4"/><text x="100" y="15" text-anchor="middle" font-size="10" fill="#333">W</text><text x="10" y="72" text-anchor="middle" font-size="10" fill="#333">L</text><text x="100" y="135" text-anchor="middle" font-size="10" fill="#333">D = Pocket Depth</text></svg>`;
    } else {
      diagramContainer.innerHTML = `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><polygon points="60,20 140,20 180,120 20,120" fill="none" stroke="#2c96f4" stroke-width="2"/><text x="100" y="15" text-anchor="middle" font-size="10" fill="#333">Head (narrow)</text><text x="100" y="135" text-anchor="middle" font-size="10" fill="#333">Foot (wide)</text><text x="8" y="72" text-anchor="middle" font-size="10" fill="#333">L</text><text x="140" y="80" text-anchor="middle" font-size="10" fill="#333">D</text></svg>`;
    }
  }

  function getCurrency() {
    if (window.MildMateGeo && window.MildMateGeo.currency) {
      return window.MildMateGeo.currency;
    }
    return 'USD';
  }

  function formatPrice(amount, currency) {
    if (currency === 'THB') {
      return '฿' + Math.round(amount).toLocaleString();
    }
    return 'USD ' + amount.toFixed(2);
  }

  function calculatePrice() {
    if (!priceDisplay) return;
    const unitLabel = state.unit === 'cm' ? 'cm' : 'in';
    const w = parseFloat(document.getElementById('cfg-width')?.value) || 0;
    const l = parseFloat(document.getElementById('cfg-length')?.value) || 0;
    const d = parseFloat(document.getElementById('cfg-depth')?.value) || 0;
    const head = parseFloat(document.getElementById('cfg-head')?.value) || 0;
    const foot = parseFloat(document.getElementById('cfg-foot')?.value) || 0;

    let area = 0;
    if (state.mode === 'sheet' && w > 0 && l > 0) {
      area = w * l;
    } else if (state.mode === 'vberth' && head > 0 && foot > 0 && l > 0) {
      area = ((head + foot) / 2) * l;
    }

    const currency = getCurrency();
    const base = BASE_PRICES[state.mode][currency.toLowerCase()] || BASE_PRICES.sheet.usd;
    const rate = FABRIC_RATES[state.fabric] || FABRIC_RATES.breezeplus;
    const extra = Math.max(0, area - (160 * 200)) * rate;
    const total = base + extra;

    priceDisplay.textContent = formatPrice(total, currency);
    priceDisplay.dataset.usd = total;
  }

  function switchMode(mode) {
    state.mode = mode;
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.mode === mode); });
    renderInputs();
    renderDiagram();
    calculatePrice();
  }

  function switchUnit(unit) {
    if (state.unit === unit) return;
    const oldUnit = state.unit;
    state.unit = unit;
    unitBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.unit === unit); });
    inputsContainer.querySelectorAll('input').forEach(function (inp) {
      const val = parseFloat(inp.value);
      if (!isNaN(val)) {
        if (oldUnit === 'cm' && unit === 'inch') {
          inp.value = (val * CM_TO_INCH).toFixed(1);
        } else if (oldUnit === 'inch' && unit === 'cm') {
          inp.value = (val * INCH_TO_CM).toFixed(1);
        }
      }
    });
    calculatePrice();
  }

  function switchFabric(fabric) {
    state.fabric = fabric;
    fabricChips.forEach(function (c) { c.classList.toggle('active', c.dataset.fabric === fabric); });
    calculatePrice();
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { switchMode(t.dataset.mode); });
  });

  unitBtns.forEach(function (b) {
    b.addEventListener('click', function () { switchUnit(b.dataset.unit); });
  });

  fabricChips.forEach(function (c) {
    c.addEventListener('click', function () { switchFabric(c.dataset.fabric); });
  });

  if (addBtn) {
    addBtn.addEventListener('click', function () {
      const item = {
        id: 'cfg-' + Date.now(),
        type: state.mode === 'sheet' ? 'Fitted Bed Sheet' : 'V-Berth Boat Sheet',
        fabric: state.fabric,
        unit: state.unit,
        dimensions: {},
        price: priceDisplay.textContent,
        qty: 1
      };
      if (state.mode === 'sheet') {
        item.dimensions.width = document.getElementById('cfg-width')?.value || '';
        item.dimensions.length = document.getElementById('cfg-length')?.value || '';
        item.dimensions.depth = document.getElementById('cfg-depth')?.value || '';
      } else {
        item.dimensions.head = document.getElementById('cfg-head')?.value || '';
        item.dimensions.foot = document.getElementById('cfg-foot')?.value || '';
        item.dimensions.length = document.getElementById('cfg-length')?.value || '';
        item.dimensions.depth = document.getElementById('cfg-depth')?.value || '';
      }
      if (window.MildMateCart) {
        window.MildMateCart.add(item);
      }
    });
  }

    renderInputs();
    renderDiagram();
    calculatePrice();
  }

  /* ── Fabric Showcase Tabs (Homepage) ─────── */
  document.querySelectorAll('.fabric-tabs').forEach(function (tabContainer) {
    const buttons = tabContainer.querySelectorAll('.fabric-tab');
    const panels = tabContainer.parentElement.querySelectorAll('.fabric-panel');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const fabric = btn.dataset.fabric;
        buttons.forEach(function (b) { b.classList.toggle('active', b.dataset.fabric === fabric); });
        panels.forEach(function (p) { p.classList.toggle('active', p.dataset.fabric === fabric); });
      });
    });
  });
})();
