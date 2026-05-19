/* ============================================
   MildMate Configurator — Phase 4
   Two-mode live price calculator + fabric tabs
   Fitted sheet formula: real pricing (THB-based)
   ============================================ */

(function () {
  // ── Pricing constants (THB) ──
  const SQCM_PER_YARD = 23744;      // 1 yard × 260cm bolt width
  const PACKING_COST = 100;
  const DOMESTIC_DELIVERY = 50;
  const OPERATING_RATE = 0.15;
  const MARKETING_RATE = 0.20;
  const MARGIN_RATE = 0.30;
  const THB_TO_USD = 30;
  const MAX_WIDTH_CM = 220;

  const FABRIC_COST_PER_YARD: Record<string, number> = {
    cloudsoft: 100,
    breezeplus: 180,
    premacotton: 180,
    ecoluxe: 180,
  };

  const SEWING_TIERS: { max: number; cost: number }[] = [
    { max: 51600, cost: 120 },
    { max: 71000, cost: 200 },
    { max: 91200, cost: 300 },
    { max: 120000, cost: 400 },
    { max: Infinity, cost: 500 },
  ];

  function getSewingCost(area: number): number {
    for (const tier of SEWING_TIERS) {
      if (area <= tier.max) return tier.cost;
    }
    return 500;
  }

  function calcFittedSheet(w: number, l: number, d: number, fabric: string): { thb: number; usd: number } {
    const fw = w + 2 * d + 14;
    const fl = l + 2 * d + 14;
    const area = fw * fl;

    const yardRate = FABRIC_COST_PER_YARD[fabric] || 100;
    const fabricCost = (area * yardRate / SQCM_PER_YARD) * 1.20;
    const sewingCost = getSewingCost(area);
    const accessories = fabricCost * 0.10;

    const subtotal = fabricCost + sewingCost + accessories + PACKING_COST + DOMESTIC_DELIVERY;
    const total = subtotal * (1 + OPERATING_RATE + MARKETING_RATE + MARGIN_RATE);
    const rounded = Math.ceil(total / 100) * 100;
    const usd = Math.round((rounded / THB_TO_USD) * 100) / 100;

    return { thb: rounded, usd: usd };
  }

  // Homepage configurator instance
  const cfg = document.getElementById('configurator');
  if (cfg) {

  let state = {
    mode: 'sheet',
    unit: 'cm',
    fabric: 'breezeplus',
    values: {}
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
    return 'THB';
  }

  function formatPrice(amount: number, currency: string): string {
    if (currency === 'THB') {
      return '\u0E3F' + amount.toLocaleString();
    }
    return 'USD ' + amount.toFixed(2);
  }

  function calculatePrice() {
    if (!priceDisplay) return;
    const w = parseFloat((document.getElementById('cfg-width') as HTMLInputElement)?.value) || 0;
    const l = parseFloat((document.getElementById('cfg-length') as HTMLInputElement)?.value) || 0;
    const d = parseFloat((document.getElementById('cfg-depth') as HTMLInputElement)?.value) || 0;
    const head = parseFloat((document.getElementById('cfg-head') as HTMLInputElement)?.value) || 0;
    const foot = parseFloat((document.getElementById('cfg-foot') as HTMLInputElement)?.value) || 0;

    const currency = getCurrency();

    if (state.mode === 'sheet' && w > 0 && l > 0 && d > 0) {
      // Convert to cm if in inches
      let wCm = w, lCm = l, dCm = d;
      if (state.unit === 'inch') {
        wCm = w * INCH_TO_CM;
        lCm = l * INCH_TO_CM;
        dCm = d * INCH_TO_CM;
      }

      if (wCm > MAX_WIDTH_CM) {
        priceDisplay.textContent = 'Custom quote — Co-Sleep size';
        return;
      }

      const result = calcFittedSheet(wCm, lCm, dCm, state.fabric);
      if (currency === 'THB') {
        priceDisplay.textContent = formatPrice(result.thb, 'THB');
      } else {
        priceDisplay.textContent = formatPrice(result.usd, 'USD');
      }
      priceDisplay.dataset.usd = String(result.usd);
      priceDisplay.dataset.thb = String(result.thb);
    } else if (state.mode === 'vberth' && head > 0 && foot > 0 && l > 0) {
      // V-Berth placeholder (legacy)
      priceDisplay.textContent = 'Custom quote — V-Berth';
    } else {
      priceDisplay.textContent = '\u2014';
    }
  }

  function switchMode(mode: string) {
    state.mode = mode;
    tabs.forEach(function (t) { t.classList.toggle('active', (t as HTMLElement).dataset.mode === mode); });
    renderInputs();
    renderDiagram();
    calculatePrice();
  }

  function switchUnit(unit: string) {
    if (state.unit === unit) return;
    const oldUnit = state.unit;
    state.unit = unit;
    unitBtns.forEach(function (b) { b.classList.toggle('active', (b as HTMLElement).dataset.unit === unit); });
    if (inputsContainer) {
      inputsContainer.querySelectorAll('input').forEach(function (inp: HTMLInputElement) {
        const val = parseFloat(inp.value);
        if (!isNaN(val)) {
          if (oldUnit === 'cm' && unit === 'inch') {
            inp.value = (val * CM_TO_INCH).toFixed(1);
          } else if (oldUnit === 'inch' && unit === 'cm') {
            inp.value = (val * INCH_TO_CM).toFixed(1);
          }
        }
      });
    }
    calculatePrice();
  }

  function switchFabric(fabric: string) {
    state.fabric = fabric;
    fabricChips.forEach(function (c) { c.classList.toggle('active', (c as HTMLElement).dataset.fabric === fabric); });
    calculatePrice();
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { switchMode((t as HTMLElement).dataset.mode || 'sheet'); });
  });

  unitBtns.forEach(function (b) {
    b.addEventListener('click', function () { switchUnit((b as HTMLElement).dataset.unit || 'cm'); });
  });

  fabricChips.forEach(function (c) {
    c.addEventListener('click', function () { switchFabric((c as HTMLElement).dataset.fabric || 'cloudsoft'); });
  });

  if (addBtn) {
    addBtn.addEventListener('click', function () {
      const item: any = {
        id: 'cfg-' + Date.now(),
        type: state.mode === 'sheet' ? 'Fitted Bed Sheet' : 'V-Berth Boat Sheet',
        fabric: state.fabric,
        unit: state.unit,
        dimensions: {},
        price: priceDisplay ? priceDisplay.textContent : '',
        qty: 1
      };
      if (state.mode === 'sheet') {
        item.dimensions.width = (document.getElementById('cfg-width') as HTMLInputElement)?.value || '';
        item.dimensions.length = (document.getElementById('cfg-length') as HTMLInputElement)?.value || '';
        item.dimensions.depth = (document.getElementById('cfg-depth') as HTMLInputElement)?.value || '';
      } else {
        item.dimensions.head = (document.getElementById('cfg-head') as HTMLInputElement)?.value || '';
        item.dimensions.foot = (document.getElementById('cfg-foot') as HTMLInputElement)?.value || '';
        item.dimensions.length = (document.getElementById('cfg-length') as HTMLInputElement)?.value || '';
        item.dimensions.depth = (document.getElementById('cfg-depth') as HTMLInputElement)?.value || '';
      }
      if ((window as any).MildMateCart) {
        (window as any).MildMateCart.add(item);
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
    const panels = (tabContainer.parentElement as HTMLElement).querySelectorAll('.fabric-panel');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const fabric = (btn as HTMLElement).dataset.fabric;
        buttons.forEach(function (b) { b.classList.toggle('active', (b as HTMLElement).dataset.fabric === fabric); });
        panels.forEach(function (p) { (p as HTMLElement).classList.toggle('active', (p as HTMLElement).dataset.fabric === fabric); });
      });
    });
  });
})();
