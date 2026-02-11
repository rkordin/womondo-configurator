/* pegasus-configurator.js */
(() => {
'use strict';

// ─────────────────────────────────────
// 1. CONFIG + DATA
// ─────────────────────────────────────
const CFG = window.PEGASUS_CFG || {};
const WEBHOOK_URL = CFG.webhookUrl || '';
const DEBUG = !!CFG.debug;
const HUBSPOT_FORM_URL = 'https://hubspotonwebflow.com/api/forms/ca46efc7-fbe4-4b8e-ac19-65287ed58319';
const log = (...a) => { if (DEBUG) console.log('[PEGASUS]', ...a); };

const fmtEUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
function formatEuro(n) { return fmtEUR.format(Number.isFinite(n) ? n : 0); }

const DATA = {
  models: [
    { id: 'regular', name: 'REGULAR', price: 99790, hp: '150 HP', trans: 'Manual transmission',
      desc: 'Pegasus Base',
      features: ['New Womondo Bathroom','New swivelling table','Rearview camera','Radio with Android Auto & Apple CarPlay','Truma 4D heating','Robeta Air Furniture','Driver compartment blackout','Awning','135 Ah Lithium battery','Solar package with inverter & 130 Wp solar panel','Maxxfan in the sleeping area'] },
    { id: 'pro', name: 'PRO', price: 115390, hp: '150 HP', trans: 'Automatic transmission',
      desc: 'Pegasus PRO',
      features: ['Active Brake Assist','93-litre main fuel tank','Longitudinal beam reinforcement','High-performance LED headlights','Exit & reversing lights underneath','Electrically operated right sliding door','Heat-insulated front windscreen','Painted bumper & corners','Cooling grille in vehicle colour','Driver & passenger seat heating','Leather steering wheel','Acoustic package','Additional warm air heating, electric','Automatic air conditioning Thermotronic','Digital radio (DAB)','Parking kit with 360\u00b0 camera','Multifunction steering wheel','Blind Spot Assist','Active Lane Keep Assist','Active Distance Assist DISTRONIC (ACC)','Rain sensor','Low-beam Assist','Wireless remote control multi-function keys','Live traffic information (pre-wiring)'] }
  ],
  upgrades: [
    { id: 'auto-gearbox', name: 'Automatic gearbox', price: 2999, requires: [], requiresModel: null },
    { id: '190hp', name: '190 hp upgrade (only with automatic gearbox)', price: 4299, requires: ['auto-gearbox'], requiresModel: null },
    { id: '4x4', name: '4\u00d74 drive option (only with automatic, 190 hp and PRO)', price: 8499, requires: ['auto-gearbox', '190hp'], requiresModel: 'pro' },
    { id: 'airmatic', name: 'AIRMATIC air suspension Mercedes-Benz', price: 4099, requires: [], requiresModel: null }
  ],
  colours: [
    { id: 'selenit-grey', name: 'Selenit Grey', price: 1999, hex: '#7C7D7E' },
    { id: 'tenorit-grey', name: 'Tenorit Grey', price: 1999, hex: '#6E6E6E' },
    { id: 'obsidian-black', name: 'Obsidian Black', price: 1999, hex: '#1C1C1C' },
    { id: 'blue-grey', name: 'Blue Grey', price: 899, hex: '#6B7B8D' },
    { id: 'pebble-grey', name: 'Pebble Grey', price: 899, hex: '#B0AFA7' },
    { id: 'white', name: 'White (standard)', price: 0, hex: '#F5F5F5' }
  ],
  packages: [
    { id: 'popup-roof', name: 'POP-UP roof (extra sleeping area \u2014 double bed 120\u00d7200 with mattress)', price: 9899 },
    { id: 'smart-tv', name: 'Smart TV package (Smart TV / bracket / 4G LTE antenna + router kit)', price: 1999 },
    { id: 'winter', name: 'Winter Package (Truma 6D + 2kW electric heating, high altitude setup, partly insulated driver cabin, heated grey water tank)', price: 1499 },
    { id: 'offroad', name: 'Off Road Pack', price: 8999 },
    { id: 'offroad-popup', name: 'Off Road pack with Pop-up Roof (pop-up roof not included)', price: 6999 },
    { id: 'side-extension', name: 'Side extension sleeping area (left + right)', price: 3999 },
    { id: 'airline', name: 'Airline system', price: 0 }
  ],
  equipment: [
    { id: 'ext-gas', name: 'External gas connection', price: 249 },
    { id: 'ext-shower', name: 'External hot & cold shower connection', price: 249 },
    { id: 'isofix', name: 'Isofix', price: 249 },
    { id: 'tow-hook', name: 'Tow hook', price: 1099 },
    { id: 'extra-bed', name: 'Extra bed in the dining area', price: 999 },
    { id: 'grey-tank-heat', name: 'Heating of grey water tank', price: 499 },
    { id: 'back-window', name: 'Back door window 500\u00d7450 (per side)', price: 489 },
    { id: 'heated-seats', name: 'Heated seats', price: 599 },
    { id: 'perfectvan-toilet', name: 'PerfectVan separation toilet', price: 2089 },
    { id: 'clesana-toilet', name: 'Clesana toilet', price: 2199 },
    { id: 'truma-4de', name: 'Truma 4DE heating', price: 599 },
    { id: 'alu-wheels', name: '16" ALU wheels (Dezent KH BLACK)', price: 1399 },
    { id: 'roof-ac', name: '2200W roof air conditioner', price: 2499 },
    { id: 'alarm-premium', name: 'Premium alarm system Thitronik', price: 1099 },
    { id: 'profinder', name: 'Thitronik Profinder', price: 699 },
    { id: 'alarm-standard', name: 'Thitronik standard alarm system \u2014 door only', price: 799 }
  ],
  transport: { name: 'Transport costs', price: 1789 }
};

const STEPS = [
  { num: 1, label: 'Model' },
  { num: 2, label: 'Upgrades' },
  { num: 3, label: 'Colour' },
  { num: 4, label: 'Packages' },
  { num: 5, label: 'Equipment' }
];

// ─────────────────────────────────────
// 2. STATE
// ─────────────────────────────────────
const state = {
  model: null,
  upgrades: new Set(),
  colour: null,
  packages: new Set(),
  equipment: new Set(),
  step: 1,
  formVisible: false,
  submitted: false
};

// ─────────────────────────────────────
// 3. HELPERS
// ─────────────────────────────────────
function getPrice(category, id) {
  if (category === 'transport') return DATA.transport.price;
  const list = DATA[category];
  if (!list) return 0;
  const item = list.find(x => x.id === id);
  return item ? item.price : 0;
}

function calculateTotal() {
  let total = 0;
  if (state.model) total += getPrice('models', state.model);
  for (const id of state.upgrades) total += getPrice('upgrades', id);
  if (state.colour) total += getPrice('colours', state.colour);
  for (const id of state.packages) total += getPrice('packages', id);
  for (const id of state.equipment) total += getPrice('equipment', id);
  total += DATA.transport.price;
  return total;
}

function isUpgradeAvailable(upgrade) {
  for (const reqId of upgrade.requires) {
    if (!state.upgrades.has(reqId)) return false;
  }
  if (upgrade.requiresModel && state.model !== upgrade.requiresModel) return false;
  return true;
}

function validateUpgrades() {
  const toRemove = [];
  for (const id of state.upgrades) {
    const u = DATA.upgrades.find(x => x.id === id);
    if (u && !isUpgradeAvailable(u)) toRemove.push(id);
  }
  toRemove.forEach(id => state.upgrades.delete(id));
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ─────────────────────────────────────
// 4. CSS INJECTION
// ─────────────────────────────────────
function injectStyles() {
  if (document.getElementById('pgc-styles')) return;
  const style = document.createElement('style');
  style.id = 'pgc-styles';
  style.textContent = `
#pegasus-modal-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:none;justify-content:center;align-items:flex-start;overflow-y:auto;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
#pegasus-modal-overlay.pgc-open{display:flex}
.pgc-modal{background:#1a1a1a;color:#fff;width:100%;max-width:920px;min-height:100vh;display:flex;flex-direction:column;position:relative}
.pgc-header{padding:20px 30px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center}
.pgc-header h2{margin:0;font-size:20px;font-weight:700;letter-spacing:.04em;color:#fff}
.pgc-close{background:none;border:none;color:#999;font-size:32px;cursor:pointer;line-height:1;padding:0 4px}
.pgc-close:hover{color:#fff}
.pgc-stepper{display:flex;padding:16px 30px;gap:4px;border-bottom:1px solid #292929;flex-wrap:wrap}
.pgc-step-pill{padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #333;background:#222;color:#888;transition:all .2s;white-space:nowrap}
.pgc-step-pill:hover{border-color:#555;color:#bbb}
.pgc-step-pill.pgc-active{background:rgb(161,113,90);color:#fff;border-color:rgb(161,113,90)}
.pgc-step-pill.pgc-done{background:#333;color:#ccc;border-color:#444}
.pgc-content{flex:1;padding:30px;padding-bottom:100px;overflow-y:auto}
.pgc-section-title{font-size:16px;font-weight:700;margin-bottom:20px;color:rgb(161,113,90);text-transform:uppercase;letter-spacing:.03em}
.pgc-model-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.pgc-model-card{background:#222;border:2px solid #333;border-radius:12px;padding:28px 24px;cursor:pointer;transition:all .2s}
.pgc-model-card:hover{border-color:#555}
.pgc-model-card.pgc-selected{border-color:rgb(161,113,90);box-shadow:0 0 20px rgba(161,113,90,.2)}
.pgc-model-name{font-size:22px;font-weight:800;margin-bottom:4px}
.pgc-model-price{font-size:28px;font-weight:700;color:rgb(161,113,90);margin-bottom:8px}
.pgc-model-desc{font-size:14px;color:#aaa;margin-bottom:14px}
.pgc-model-features{font-size:12px;color:#777;line-height:1.6}
.pgc-model-features b{color:#aaa;display:block;margin-bottom:4px;font-size:13px}
.pgc-item-row{display:flex;align-items:center;gap:14px;padding:14px 18px;background:#222;border:2px solid #333;border-radius:10px;margin-bottom:10px;cursor:pointer;transition:all .2s;user-select:none}
.pgc-item-row:hover{border-color:#555}
.pgc-item-row.pgc-selected{border-color:rgb(161,113,90);background:#2a2219}
.pgc-item-row.pgc-disabled{opacity:.35;pointer-events:none;cursor:not-allowed}
.pgc-check{width:22px;height:22px;border-radius:6px;border:2px solid #555;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .2s;font-size:14px;color:transparent}
.pgc-selected .pgc-check{background:rgb(161,113,90);border-color:rgb(161,113,90);color:#fff}
.pgc-item-label{flex:1;font-size:14px;line-height:1.4}
.pgc-item-price{font-size:14px;font-weight:600;color:rgb(161,113,90);white-space:nowrap}
.pgc-item-req{font-size:11px;color:#666;margin-top:2px}
.pgc-colour-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.pgc-colour-card{background:#222;border:2px solid #333;border-radius:12px;padding:20px 14px;cursor:pointer;text-align:center;transition:all .2s}
.pgc-colour-card:hover{border-color:#555}
.pgc-colour-card.pgc-selected{border-color:rgb(161,113,90);box-shadow:0 0 16px rgba(161,113,90,.2)}
.pgc-swatch{width:48px;height:48px;border-radius:50%;margin:0 auto 10px;border:3px solid #444;transition:border-color .2s}
.pgc-colour-card.pgc-selected .pgc-swatch{border-color:rgb(161,113,90)}
.pgc-colour-name{font-size:13px;font-weight:600;margin-bottom:4px}
.pgc-colour-price{font-size:13px;color:rgb(161,113,90)}
.pgc-transport-row{display:flex;justify-content:space-between;padding:14px 18px;background:#1e1e1e;border:1px dashed #444;border-radius:10px;margin-top:16px;color:#999;font-size:14px}
.pgc-transport-row span:last-child{color:rgb(161,113,90);font-weight:600}
.pgc-total-bar{position:sticky;bottom:0;background:#111;border-top:1px solid #333;padding:16px 30px;display:flex;align-items:center;justify-content:space-between;gap:16px;z-index:10}
.pgc-total-label{font-size:14px;color:#888}
.pgc-total-price{font-size:22px;font-weight:800;color:#fff;flex:1;text-align:right;padding-right:20px}
.pgc-nav-btns{display:flex;gap:10px}
.pgc-btn{padding:12px 28px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;text-transform:uppercase;letter-spacing:.03em}
.pgc-btn-primary{background:rgb(161,113,90);color:#fff}
.pgc-btn-primary:hover{background:rgb(181,133,110)}
.pgc-btn-secondary{background:#333;color:#ccc}
.pgc-btn-secondary:hover{background:#444}
.pgc-form{max-width:480px;margin:0 auto}
.pgc-form h3{font-size:20px;font-weight:700;margin-bottom:8px;color:rgb(161,113,90)}
.pgc-form p{font-size:14px;color:#888;margin-bottom:24px}
.pgc-form input,.pgc-form select{width:100%;padding:14px 16px;border:2px solid #333;border-radius:8px;background:#222;color:#fff;font-size:14px;margin-bottom:12px;box-sizing:border-box;outline:none;transition:border-color .2s}
.pgc-form input:focus,.pgc-form select:focus{border-color:rgb(161,113,90)}
.pgc-form input::placeholder{color:#666}
.pgc-form select{appearance:none;-webkit-appearance:none}
.pgc-form-submit{width:100%;padding:16px;border:none;border-radius:8px;background:rgb(161,113,90);color:#fff;font-size:16px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:.04em;margin-top:8px;transition:background .2s}
.pgc-form-submit:hover{background:rgb(181,133,110)}
.pgc-form-submit:disabled{opacity:.5;cursor:not-allowed}
.pgc-consent-block{margin-top:16px;margin-bottom:12px}
.pgc-consent-block p{font-size:12px;color:#777;line-height:1.5;margin-bottom:10px}
.pgc-consent-block a{color:rgb(161,113,90);text-decoration:underline}
.pgc-consent-label{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;cursor:pointer;font-size:13px;color:#ccc;line-height:1.4}
.pgc-consent-label input[type="checkbox"]{width:18px;height:18px;flex-shrink:0;margin-top:1px;accent-color:rgb(161,113,90);cursor:pointer}
.pgc-form-row{display:flex;gap:12px}
.pgc-form-row input{flex:1}
.pgc-success{text-align:center;padding:60px 20px}
.pgc-success h3{font-size:22px;font-weight:700;margin-bottom:12px;color:#fff}
.pgc-success p{color:#888;margin-bottom:30px;font-size:14px}
.pgc-success .pgc-btn{padding:18px 40px;font-size:16px}
.pgc-start-over{margin-top:20px;background:none;border:1px solid #444;color:#888;padding:12px 28px;border-radius:8px;cursor:pointer;font-size:13px;transition:all .2s}
.pgc-start-over:hover{border-color:#888;color:#ccc}
@media(max-width:640px){
.pgc-model-grid{grid-template-columns:1fr}
.pgc-colour-grid{grid-template-columns:1fr 1fr}
.pgc-header{padding:16px 20px}
.pgc-header h2{font-size:16px}
.pgc-content{padding:20px}
.pgc-stepper{padding:12px 16px;gap:6px}
.pgc-step-pill{padding:6px 12px;font-size:11px}
.pgc-total-bar{padding:12px 16px;flex-wrap:wrap}
.pgc-total-price{font-size:18px;padding-right:10px}
.pgc-nav-btns{width:100%;justify-content:stretch}
.pgc-nav-btns .pgc-btn{flex:1}
.pgc-form-row{flex-direction:column;gap:0}
}
`;
  document.head.appendChild(style);
}

// ─────────────────────────────────────
// 5. MODAL STRUCTURE
// ─────────────────────────────────────
let modalEl = null;
let contentEl = null;
let stepperEl = null;
let totalPriceEl = null;
let navBtnsEl = null;

function createModal() {
  const overlay = document.createElement('div');
  overlay.id = 'pegasus-modal-overlay';
  overlay.innerHTML = `
    <div class="pgc-modal">
      <div class="pgc-header">
        <h2>CONFIGURE YOUR PEGASUS</h2>
        <button class="pgc-close" aria-label="Close">&times;</button>
      </div>
      <div class="pgc-stepper"></div>
      <div class="pgc-content"></div>
      <div class="pgc-total-bar">
        <span class="pgc-total-label">Total (incl. VAT)</span>
        <span class="pgc-total-price">0,00 &euro;</span>
        <div class="pgc-nav-btns"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  modalEl = overlay;
  contentEl = overlay.querySelector('.pgc-content');
  stepperEl = overlay.querySelector('.pgc-stepper');
  totalPriceEl = overlay.querySelector('.pgc-total-price');
  navBtnsEl = overlay.querySelector('.pgc-nav-btns');

  overlay.querySelector('.pgc-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('pgc-open')) closeModal(); });
}

function openModal() {
  resetState();
  modalEl.classList.add('pgc-open');
  document.body.style.overflow = 'hidden';
  renderAll();
}

function closeModal() {
  modalEl.classList.remove('pgc-open');
  document.body.style.overflow = '';
}

function resetState() {
  state.model = null;
  state.upgrades.clear();
  state.colour = null;
  state.packages.clear();
  state.equipment.clear();
  state.step = 1;
  state.formVisible = false;
  state.submitted = false;
}

// ─────────────────────────────────────
// 6. RENDER
// ─────────────────────────────────────
function renderAll() {
  renderStepper();
  renderContent();
  renderTotalBar();
}

function renderStepper() {
  if (state.formVisible || state.submitted) {
    stepperEl.innerHTML = '';
    return;
  }
  stepperEl.innerHTML = STEPS.map(s => {
    let cls = 'pgc-step-pill';
    if (s.num === state.step) cls += ' pgc-active';
    else if (s.num < state.step) cls += ' pgc-done';
    return `<div class="${cls}" data-step="${s.num}">${s.num}. ${esc(s.label)}</div>`;
  }).join('');

  stepperEl.querySelectorAll('.pgc-step-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const n = parseInt(pill.getAttribute('data-step'), 10);
      if (n <= state.step || n === state.step + 1) {
        state.step = n;
        state.formVisible = false;
        state.submitted = false;
        renderAll();
      }
    });
  });
}

function renderContent() {
  if (state.submitted) { renderSuccess(); return; }
  if (state.formVisible) { renderForm(); return; }
  switch (state.step) {
    case 1: renderStep1(); break;
    case 2: renderStep2(); break;
    case 3: renderStep3(); break;
    case 4: renderStep4(); break;
    case 5: renderStep5(); break;
  }
  contentEl.scrollTop = 0;
}

function renderTotalBar() {
  totalPriceEl.textContent = formatEuro(calculateTotal());

  if (state.submitted) {
    navBtnsEl.innerHTML = '';
    return;
  }

  let html = '';
  if (state.formVisible) {
    html = `<button class="pgc-btn pgc-btn-secondary pgc-back-btn">BACK</button>`;
  } else {
    if (state.step > 1) html += `<button class="pgc-btn pgc-btn-secondary pgc-back-btn">BACK</button>`;
    if (state.step < 5) {
      html += `<button class="pgc-btn pgc-btn-primary pgc-next-btn">NEXT</button>`;
    } else {
      html += `<button class="pgc-btn pgc-btn-primary pgc-finish-btn">GET YOUR CONFIGURATION</button>`;
    }
  }
  navBtnsEl.innerHTML = html;

  const backBtn = navBtnsEl.querySelector('.pgc-back-btn');
  const nextBtn = navBtnsEl.querySelector('.pgc-next-btn');
  const finishBtn = navBtnsEl.querySelector('.pgc-finish-btn');

  if (backBtn) backBtn.addEventListener('click', () => {
    if (state.formVisible) { state.formVisible = false; renderAll(); }
    else if (state.step > 1) { state.step--; renderAll(); }
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (state.step < 5) { state.step++; renderAll(); }
  });
  if (finishBtn) finishBtn.addEventListener('click', () => {
    state.formVisible = true;
    renderAll();
  });
}

// ── Step 1: Model ──
function renderStep1() {
  contentEl.innerHTML = `
    <div class="pgc-section-title">Step 1 — Choose your model</div>
    <div class="pgc-model-grid">
      ${DATA.models.map(m => `
        <div class="pgc-model-card${state.model === m.id ? ' pgc-selected' : ''}" data-model="${m.id}">
          <div class="pgc-model-name">${esc(m.name)}</div>
          <div class="pgc-model-price">${formatEuro(m.price)}</div>
          <div class="pgc-model-desc">${esc(m.desc)} — ${esc(m.hp)}, ${esc(m.trans)}</div>
          <div class="pgc-model-features">
            <b>${m.id === 'pro' ? 'PRO adds (in addition to Regular):' : 'Standard includes:'}</b>
            ${m.features.map(f => esc(f)).join(' &middot; ')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  contentEl.querySelectorAll('.pgc-model-card').forEach(card => {
    card.addEventListener('click', () => {
      state.model = card.getAttribute('data-model');
      validateUpgrades();
      renderAll();
    });
  });
}

// ── Step 2: Upgrades ──
function renderStep2() {
  contentEl.innerHTML = `
    <div class="pgc-section-title">Step 2 — Upgrade options</div>
    ${DATA.upgrades.map(u => {
      const available = isUpgradeAvailable(u);
      const selected = state.upgrades.has(u.id);
      let cls = 'pgc-item-row';
      if (selected) cls += ' pgc-selected';
      if (!available) cls += ' pgc-disabled';
      let reqText = '';
      if (u.requires.length || u.requiresModel) {
        const parts = [];
        u.requires.forEach(r => {
          const dep = DATA.upgrades.find(x => x.id === r);
          if (dep) parts.push(dep.name.split('(')[0].trim());
        });
        if (u.requiresModel) parts.push(u.requiresModel.toUpperCase() + ' model');
        reqText = `<div class="pgc-item-req">Requires: ${esc(parts.join(' + '))}</div>`;
      }
      return `
        <div class="${cls}" data-id="${u.id}">
          <div class="pgc-check">\u2713</div>
          <div class="pgc-item-label">${esc(u.name)}${reqText}</div>
          <div class="pgc-item-price">${u.price > 0 ? '+' + formatEuro(u.price) : 'Included'}</div>
        </div>`;
    }).join('')}
  `;
  contentEl.querySelectorAll('.pgc-item-row:not(.pgc-disabled)').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      if (state.upgrades.has(id)) state.upgrades.delete(id);
      else state.upgrades.add(id);
      validateUpgrades();
      renderAll();
    });
  });
}

// ── Step 3: Colour ──
function renderStep3() {
  contentEl.innerHTML = `
    <div class="pgc-section-title">Step 3 — Choose your colour</div>
    <div class="pgc-colour-grid">
      ${DATA.colours.map(c => `
        <div class="pgc-colour-card${state.colour === c.id ? ' pgc-selected' : ''}" data-id="${c.id}">
          <div class="pgc-swatch" style="background:${c.hex}"></div>
          <div class="pgc-colour-name">${esc(c.name)}</div>
          <div class="pgc-colour-price">${c.price > 0 ? '+' + formatEuro(c.price) : 'Standard'}</div>
        </div>
      `).join('')}
    </div>
  `;
  contentEl.querySelectorAll('.pgc-colour-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      state.colour = (state.colour === id) ? null : id;
      renderAll();
    });
  });
}

// ── Step 4: Packages ──
function renderStep4() {
  contentEl.innerHTML = `
    <div class="pgc-section-title">Step 4 — Womondo packages</div>
    ${DATA.packages.map(p => {
      const selected = state.packages.has(p.id);
      return `
        <div class="pgc-item-row${selected ? ' pgc-selected' : ''}" data-id="${p.id}">
          <div class="pgc-check">\u2713</div>
          <div class="pgc-item-label">${esc(p.name)}</div>
          <div class="pgc-item-price">${p.price > 0 ? '+' + formatEuro(p.price) : 'Included'}</div>
        </div>`;
    }).join('')}
  `;
  contentEl.querySelectorAll('.pgc-item-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      if (state.packages.has(id)) state.packages.delete(id);
      else state.packages.add(id);
      renderAll();
    });
  });
}

// ── Step 5: Equipment ──
function renderStep5() {
  contentEl.innerHTML = `
    <div class="pgc-section-title">Step 5 — Additional equipment</div>
    ${DATA.equipment.map(e => {
      const selected = state.equipment.has(e.id);
      return `
        <div class="pgc-item-row${selected ? ' pgc-selected' : ''}" data-id="${e.id}">
          <div class="pgc-check">\u2713</div>
          <div class="pgc-item-label">${esc(e.name)}</div>
          <div class="pgc-item-price">${e.price > 0 ? '+' + formatEuro(e.price) : 'Included'}</div>
        </div>`;
    }).join('')}
    <div class="pgc-transport-row">
      <span>${esc(DATA.transport.name)} (always included)</span>
      <span>${formatEuro(DATA.transport.price)}</span>
    </div>
  `;
  contentEl.querySelectorAll('.pgc-item-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      if (state.equipment.has(id)) state.equipment.delete(id);
      else state.equipment.add(id);
      renderAll();
    });
  });
}

// ─────────────────────────────────────
// 7. FORM  (HubSpot-connected)
// ─────────────────────────────────────
function renderForm() {
  const summaryText = buildSummaryText();
  contentEl.innerHTML = `
    <div class="pgc-form">
      <h3>Get your configuration</h3>
      <p>Leave your contact details so we can send you the configuration and say hello.</p>
      <form id="pgc-contact-form"
            action="${esc(HUBSPOT_FORM_URL)}"
            method="POST"
            enctype="multipart/form-data"
            data-name="WOMONDO PEGASUS CONFIGURATOR"
            data-wf-hs-form="webflowHubSpotForm"
            data-wf-page-id="69674f7a8346b86879ce8dbc"
            data-wf-element-id="afad9089-6572-2c8c-7157-779d36f5a563"
            novalidate>

        <div class="pgc-form-row">
          <input type="text" name="firstname" placeholder="First name *" required />
          <input type="text" name="lastname" placeholder="Last name *" required />
        </div>
        <input type="email" name="email" placeholder="Email *" required />
        <input type="text" name="country" placeholder="Country / Region" />
        <div class="pgc-form-row">
          <input type="text" name="zip" placeholder="Postal code" />
          <input type="tel" name="phone" placeholder="Phone number" />
        </div>

        <!-- Hidden fields for HubSpot -->
        <textarea name="customes_configuration_and_price" style="display:none">${esc(summaryText)}</textarea>
        <select name="contact_origin" hidden style="display:none">
          <option value="WOMONOD CONFIGURATOR (rok)" selected>WOMONDO CONFIGURATOR (rok)</option>
        </select>
        <input type="hidden" name="assigned_dealer" value="" />
        <input type="hidden" name="hutk" value="" />
        <input type="hidden" name="ipAddress" value="" />
        <input type="hidden" name="pageUri" value="" />
        <input type="hidden" name="pageId" value="" />
        <input type="hidden" name="pageName" value="" />

        <!-- Consent -->
        <div class="pgc-consent-block">
          <p>Robeta uses your contact information to respond to your request and keep you informed about our products, services, and news. Please indicate below how you prefer to be contacted:</p>
          <label class="pgc-consent-label">
            <input type="checkbox" name="895486508" value="895486508" required />
            <span>I agree that Robeta can contact me regarding my request. *</span>
          </label>
          <label class="pgc-consent-label">
            <input type="checkbox" name="890239396" value="890239396" />
            <span>I agree to receive information about products, services, and news from Robeta.</span>
          </label>
          <p>You can unsubscribe from communication at any time. Details about data protection and your rights can be found in our <a href="https://www.robeta-campervans.com/legal-notice" target="_blank" rel="nofollow noopener noreferrer">privacy policy</a>.</p>
          <p>By clicking submit below, you consent to allow Robeta to store and process the personal information submitted above to handle your request.</p>
        </div>

        <button type="submit" class="pgc-form-submit">SUBMIT</button>
      </form>
    </div>
  `;

  const form = contentEl.querySelector('#pgc-contact-form');

  // Fill HubSpot tracking hidden fields
  try {
    form.querySelector('[name="pageUri"]').value = window.location.href;
    form.querySelector('[name="pageName"]').value = document.title;
    form.querySelector('[name="pageId"]').value = '69674f7a8346b86879ce8dbc';
    // Try to get HubSpot cookie for tracking
    const hutk = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('hubspotutk='));
    if (hutk) form.querySelector('[name="hutk"]').value = hutk.split('=')[1];
  } catch (e) { /* optional */ }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit(form);
  });
}

function handleFormSubmit(form) {
  const fd = new FormData(form);
  const firstname = (fd.get('firstname') || '').toString().trim();
  const lastname = (fd.get('lastname') || '').toString().trim();
  const email = (fd.get('email') || '').toString().trim();
  const consentRequired = form.querySelector('[name="895486508"]');

  if (!firstname || !lastname) { alert('Please enter your first and last name.'); return; }
  if (!email || !email.includes('@')) { alert('Please enter a valid email address.'); return; }
  if (consentRequired && !consentRequired.checked) { alert('Please agree to the contact consent to continue.'); return; }

  // Disable button to prevent double-submit
  const submitBtn = form.querySelector('.pgc-form-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'SUBMITTING...'; }

  // Build contact object for webhook
  const contact = {
    firstName: firstname,
    lastName: lastname,
    email,
    phone: (fd.get('phone') || '').toString().trim(),
    country: (fd.get('country') || '').toString().trim(),
    zip: (fd.get('zip') || '').toString().trim()
  };

  // 1) Submit to HubSpot via fetch (mirrors native form action)
  submitToHubSpot(fd).then(() => {
    log('HubSpot form submitted');
  }).catch(err => {
    console.warn('[PEGASUS] HubSpot submit error:', err);
  });

  // 2) Also send to Pipedream webhook (backup / automation)
  const payload = buildPayload(contact);
  postWebhook(payload);

  // 3) Show success
  state.submitted = true;
  renderAll();
}

async function submitToHubSpot(formData) {
  try {
    const resp = await fetch(HUBSPOT_FORM_URL, {
      method: 'POST',
      body: formData,
    });
    log('HubSpot response status:', resp.status);
    return resp;
  } catch (err) {
    console.warn('[PEGASUS] HubSpot submit error:', err);
    throw err;
  }
}

// ─────────────────────────────────────
// 8. PAYLOAD + WEBHOOK
// ─────────────────────────────────────
function buildSummaryText() {
  const lines = [];
  lines.push('=== PEGASUS CONFIGURATION ===');
  lines.push('Date: ' + new Date().toLocaleDateString('de-DE'));
  lines.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const model = DATA.models.find(m => m.id === state.model);
  lines.push('MODEL: Womondo Pegasus ' + (model ? model.name : 'N/A'));
  if (model) lines.push('Base Price: ' + formatEuro(model.price));
  lines.push('');

  if (state.upgrades.size) {
    lines.push('UPGRADES:');
    for (const id of state.upgrades) {
      const u = DATA.upgrades.find(x => x.id === id);
      if (u) lines.push('  \u2022 ' + u.name + ': ' + formatEuro(u.price));
    }
    lines.push('');
  }

  if (state.colour) {
    const c = DATA.colours.find(x => x.id === state.colour);
    if (c) lines.push('COLOUR: ' + c.name + ' (' + formatEuro(c.price) + ')');
    lines.push('');
  }

  if (state.packages.size) {
    lines.push('PACKAGES:');
    for (const id of state.packages) {
      const p = DATA.packages.find(x => x.id === id);
      if (p) lines.push('  \u2022 ' + p.name + ': ' + formatEuro(p.price));
    }
    lines.push('');
  }

  if (state.equipment.size) {
    lines.push('ADDITIONAL EQUIPMENT:');
    for (const id of state.equipment) {
      const eq = DATA.equipment.find(x => x.id === id);
      if (eq) lines.push('  \u2022 ' + eq.name + ': ' + formatEuro(eq.price));
    }
    lines.push('');
  }

  lines.push('TRANSPORT: ' + formatEuro(DATA.transport.price));
  lines.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  lines.push('TOTAL (incl. VAT): ' + formatEuro(calculateTotal()));
  lines.push('=============================');
  return lines.join('\n');
}

function buildPayload(contact) {
  const model = DATA.models.find(m => m.id === state.model);
  return {
    source: 'pegasus-configurator',
    timestamp: new Date().toISOString(),
    contact,
    configuration: {
      model: state.model,
      modelName: model ? model.name : null,
      modelPrice: model ? model.price : 0,
      upgrades: [...state.upgrades].map(id => {
        const u = DATA.upgrades.find(x => x.id === id);
        return { id, name: u?.name, price: u?.price || 0 };
      }),
      colour: state.colour ? (() => {
        const c = DATA.colours.find(x => x.id === state.colour);
        return { id: state.colour, name: c?.name, price: c?.price || 0 };
      })() : null,
      packages: [...state.packages].map(id => {
        const p = DATA.packages.find(x => x.id === id);
        return { id, name: p?.name, price: p?.price || 0 };
      }),
      equipment: [...state.equipment].map(id => {
        const e = DATA.equipment.find(x => x.id === id);
        return { id, name: e?.name, price: e?.price || 0 };
      }),
      transport: DATA.transport
    },
    total_gross: calculateTotal(),
    note: buildSummaryText()
  };
}

async function postWebhook(payload) {
  if (!WEBHOOK_URL) { log('No webhookUrl configured'); return; }
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon(WEBHOOK_URL, blob)) {
      log('Webhook sent via sendBeacon');
      return;
    }
  } catch (e) { /* fallback to fetch */ }
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
    log('Webhook sent via fetch');
  } catch (err) {
    console.warn('[PEGASUS] Webhook error:', err);
  }
}

// ─────────────────────────────────────
// 9. SUCCESS + PDF
// ─────────────────────────────────────
function renderSuccess() {
  contentEl.innerHTML = `
    <div class="pgc-success">
      <h3>Thank you! Your submission has been received!</h3>
      <p>Make sure to download your configuration.</p>
      <button class="pgc-btn pgc-btn-primary pgc-pdf-btn">DOWNLOAD PDF</button>
      <br/>
      <button class="pgc-start-over">Start a new configuration</button>
    </div>
  `;
  contentEl.querySelector('.pgc-pdf-btn').addEventListener('click', generatePDF);
  contentEl.querySelector('.pgc-start-over').addEventListener('click', () => {
    resetState();
    renderAll();
  });
}

async function generatePDF() {
  try {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) { alert('PDF not available (jsPDF not loaded).'); return; }

    const model = DATA.models.find(m => m.id === state.model);
    const modelLabel = 'Womondo Pegasus ' + (model ? model.name : '');
    const total = calculateTotal();
    const fmt = formatEuro;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const BRAND = { r: 161, g: 113, b: 90 };
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MX = 18, MT = 18, MB = 18, LH = 5;
    const maxW = PAGE_W - MX * 2;

    const setBrand = () => doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    const setInk = () => doc.setTextColor(0, 0, 0);
    const ensureSpace = (need, y) => (y + need > PAGE_H - MB) ? (doc.addPage(), MT) : y;
    const hr = (y) => { doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3); doc.line(MX, y, PAGE_W - MX, y); return y + 6; };
    const textW = (str, x, y, w, sz, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(sz || 11);
      const lines = doc.splitTextToSize(String(str || ''), w);
      doc.text(lines, x, y);
      return y + lines.length * LH;
    };

    let y = MT;

    // Logo
    try {
      const resp = await fetch('https://cdn.prod.website-files.com/688c97f5afd8282a32cb8652/69875293a43d78238cf14721_Logo-womondo.png', { cache: 'no-store' });
      if (resp.ok) {
        const blob = await resp.blob();
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
        doc.addImage(dataUrl, 'PNG', (PAGE_W - 55) / 2, y, 55, 18);
        y += 26;
      }
    } catch (e) { /* logo optional */ }

    // Title
    y = ensureSpace(18, y);
    setBrand();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('PEGASUS CONFIGURATION', PAGE_W / 2, y, { align: 'center' });
    y += 8;
    y = hr(y);

    // Meta
    setInk();
    y = textW('Date: ' + new Date().toLocaleDateString('de-DE'), MX, y, maxW, 11, false);
    y += 2;
    y = hr(y);

    // Model
    y = ensureSpace(20, y);
    y = textW('Model: ' + modelLabel, MX, y, maxW, 12, true);
    y = textW('Base Price (gross): ' + fmt(model ? model.price : 0), MX, y, maxW, 11, false);

    // Upgrades
    if (state.upgrades.size) {
      y += 2;
      y = ensureSpace(14, y);
      setBrand();
      y = textW('Upgrades', MX, y, maxW, 12, true);
      setInk();
      for (const id of state.upgrades) {
        const u = DATA.upgrades.find(x => x.id === id);
        if (!u) continue;
        y = ensureSpace(10, y);
        y = textW('\u2022 ' + u.name, MX, y, maxW - 35, 11, false);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(fmt(u.price), PAGE_W - MX, y - LH, { align: 'right' });
      }
    }

    // Colour
    if (state.colour) {
      const c = DATA.colours.find(x => x.id === state.colour);
      if (c) {
        y += 2;
        y = ensureSpace(14, y);
        setBrand();
        y = textW('Colour', MX, y, maxW, 12, true);
        setInk();
        y = ensureSpace(10, y);
        y = textW('\u2022 ' + c.name, MX, y, maxW - 35, 11, false);
        doc.text(fmt(c.price), PAGE_W - MX, y - LH, { align: 'right' });
      }
    }

    // Packages
    if (state.packages.size) {
      y += 2;
      y = ensureSpace(14, y);
      setBrand();
      y = textW('Packages', MX, y, maxW, 12, true);
      setInk();
      for (const id of state.packages) {
        const p = DATA.packages.find(x => x.id === id);
        if (!p) continue;
        y = ensureSpace(10, y);
        y = textW('\u2022 ' + p.name, MX, y, maxW - 35, 11, false);
        doc.text(fmt(p.price), PAGE_W - MX, y - LH, { align: 'right' });
      }
    }

    // Equipment
    if (state.equipment.size) {
      y += 2;
      y = ensureSpace(14, y);
      setBrand();
      y = textW('Additional Equipment', MX, y, maxW, 12, true);
      setInk();
      for (const id of state.equipment) {
        const eq = DATA.equipment.find(x => x.id === id);
        if (!eq) continue;
        y = ensureSpace(10, y);
        y = textW('\u2022 ' + eq.name, MX, y, maxW - 35, 11, false);
        doc.text(fmt(eq.price), PAGE_W - MX, y - LH, { align: 'right' });
      }
    }

    // Transport
    y += 2;
    y = ensureSpace(14, y);
    setBrand();
    y = textW('Transport', MX, y, maxW, 12, true);
    setInk();
    y = ensureSpace(10, y);
    y = textW('\u2022 ' + DATA.transport.name, MX, y, maxW - 35, 11, false);
    doc.text(fmt(DATA.transport.price), PAGE_W - MX, y - LH, { align: 'right' });

    // Total
    y += 6;
    y = hr(y);
    y = ensureSpace(18, y);
    setBrand();
    y = textW('Price Summary', MX, y, maxW, 12, true);
    setInk();
    y = textW('TOTAL (incl. VAT): ' + fmt(total), MX, y, maxW, 12, true);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setBrand();
    doc.text(
      'ROBETA d.o.o., Pohorska cesta 6B, 2380 Slovenj Gradec, Slovenia, E: info@robetamobil.si, T: +386 40 866 280, S: www.robetamobil.si',
      PAGE_W / 2, PAGE_H - 10, { align: 'center', maxWidth: PAGE_W - 20 }
    );

    doc.setProperties({ title: modelLabel + ' Configuration' });
    doc.save('Pegasus-' + (model ? model.name : 'Config') + '-Configuration.pdf');
    log('PDF generated');
  } catch (err) {
    console.error('[PEGASUS-PDF] Failed:', err);
    alert('PDF generation failed. Check console.');
  }
}

// ─────────────────────────────────────
// 10. INIT
// ─────────────────────────────────────
function initialize() {
  injectStyles();
  createModal();

  // Bind the CTA button on the Pegasus page
  const btn = document.getElementById('pegasus-configure-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  }

  // Also support any element with .pegasus-configure-btn class
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.pegasus-configure-btn, #pegasus-configure-btn');
    if (target) {
      e.preventDefault();
      openModal();
    }
  });

  log('Pegasus Configurator READY');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

})();
