/* pegasus-configurator.js */
(() => {
'use strict';

// ─────────────────────────────────────
// 1. CONFIG + DATA
// ─────────────────────────────────────
const CFG = window.PEGASUS_CFG || {};
const CSV_URL = CFG.csvUrl || '';
const WEBHOOK_URL = CFG.webhookUrl || '';
const DEBUG = !!CFG.debug;
const HUBSPOT_FORM_URL = 'https://hubspotonwebflow.com/api/forms/ca46efc7-fbe4-4b8e-ac19-65287ed58319';
const log = (...a) => { if (DEBUG) console.log('[PEGASUS]', ...a); };

const fmtEUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
function formatEuro(n) { return fmtEUR.format(Number.isFinite(n) ? n : 0); }

// Country label → CSV column header
const COUNTRY_MAP = {
  'Germany': 'DE', 'Austria': 'AT', 'Belgium': 'BE', 'Bulgaria': 'BG',
  'Croatia': 'HR', 'Czech Republic': 'CZ', 'Denmark': 'DK', 'Estonia': 'EE',
  'Finland': 'FI', 'France': 'FR', 'Greece': 'GR', 'Hungary': 'HU',
  'Italy': 'IT', 'Netherlands': 'NL', 'Poland': 'PL', 'Portugal': 'PT',
  'Romania': 'RO', 'Slovenia': 'SI', 'Spain': 'ES', 'Sweden': 'SE'
};
const COUNTRY_LIST = Object.keys(COUNTRY_MAP);

// EU countries for form dropdown (full list)
const EU_COUNTRIES = [
  'Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic',
  'Denmark','Estonia','Finland','France','Germany','Greece','Hungary',
  'Ireland','Italy','Latvia','Lithuania','Luxembourg','Malta',
  'Netherlands','Poland','Portugal','Romania','Slovakia','Slovenia',
  'Spain','Sweden'
];

// Phone dial codes per EU country
const DIAL = {
  'AUSTRIA':'+43','BELGIUM':'+32','BULGARIA':'+359','CROATIA':'+385',
  'CYPRUS':'+357','CZECH REPUBLIC':'+420','DENMARK':'+45','ESTONIA':'+372',
  'FINLAND':'+358','FRANCE':'+33','GERMANY':'+49','GREECE':'+30',
  'HUNGARY':'+36','IRELAND':'+353','ITALY':'+39','LATVIA':'+371',
  'LITHUANIA':'+370','LUXEMBOURG':'+352','MALTA':'+356','NETHERLANDS':'+31',
  'POLAND':'+48','PORTUGAL':'+351','ROMANIA':'+40','SLOVAKIA':'+421',
  'SLOVENIA':'+386','SPAIN':'+34','SWEDEN':'+46'
};

// Postal code validation patterns per country
const POSTAL_PATTERNS = {
  'Germany': /^\d{5}$/, 'Austria': /^\d{4}$/, 'Belgium': /^\d{4}$/,
  'France': /^\d{5}$/, 'Italy': /^\d{5}$/, 'Spain': /^\d{5}$/,
  'Portugal': /^\d{4}-?\d{3}$/, 'Poland': /^\d{2}-?\d{3}$/,
  'Czech Republic': /^\d{3}\s?\d{2}$/, 'Denmark': /^\d{4}$/,
  'Sweden': /^\d{3}\s?\d{2}$/, 'Finland': /^\d{5}$/,
  'Slovenia': /^\d{4}$/, 'Slovakia': /^\d{3}\s?\d{2}$/,
  'Hungary': /^\d{4}$/, 'Croatia': /^\d{5}$/,
  'Netherlands': /^\d{4}\s?[A-Z]{2}$/i, 'Romania': /^\d{6}$/,
  'Bulgaria': /^\d{4}$/, 'Greece': /^\d{3}\s?\d{2}$/,
  'Ireland': /^[A-Za-z]\d[\dWw]\s?[A-Za-z\d]{4}$/i,
  'Luxembourg': /^\d{4}$/, 'Malta': /^[A-Z]{3}\s?\d{2,4}$/i,
  'Cyprus': /^\d{4}$/, 'Lithuania': /^LT-?\d{5}$/i,
  'Latvia': /^LV-?\d{4}$/i, 'Estonia': /^\d{5}$/
};

// MO_CODE → item id mapping (used to look up CSV row)
const CODE_MAP = {
  // Models
  'P3GR3G':   { cat: 'models',    id: 'regular' },
  'P3GPR0':   { cat: 'models',    id: 'pro' },
  // Upgrades
  'UP4U70':   { cat: 'upgrades',  id: 'auto-gearbox' },
  'UP190HP':  { cat: 'upgrades',  id: '190hp' },
  'UP4X4':    { cat: 'upgrades',  id: '4x4' },
  'UP41RM47': { cat: 'upgrades',  id: 'airmatic' },
  // Colours
  'C0L53L3N': { cat: 'colours',   id: 'selenit-grey' },
  'C0L73N0R': { cat: 'colours',   id: 'tenorit-grey' },
  'C0L0B51D': { cat: 'colours',   id: 'obsidian-black' },
  'C0LBLU3G': { cat: 'colours',   id: 'blue-grey' },
  'C0LP3BBL': { cat: 'colours',   id: 'pebble-grey' },
  'C0LWH173': { cat: 'colours',   id: 'white' },
  // Packages
  'PKGP0PUP': { cat: 'packages',  id: 'popup-roof' },
  'PKG5M4R7': { cat: 'packages',  id: 'smart-tv' },
  'PKGW1N73': { cat: 'packages',  id: 'winter' },
  'PKG0FFR0': { cat: 'packages',  id: 'offroad' },
  'PKG0FCL5': { cat: 'packages',  id: 'offroad-popup' },
  '0P751D33': { cat: 'packages',  id: 'side-extension' },
  '0P741RL1': { cat: 'packages',  id: 'airline' },
  // Equipment
  '3Q3X7G45': { cat: 'equipment', id: 'ext-gas' },
  '3Q3X75H0': { cat: 'equipment', id: 'ext-shower' },
  '3Q150F1X': { cat: 'equipment', id: 'isofix' },
  '3Q70WH00': { cat: 'equipment', id: 'tow-hook' },
  '3Q3X7R4B': { cat: 'equipment', id: 'extra-bed' },
  '3QGR3YW4': { cat: 'equipment', id: 'grey-tank-heat' },
  '3QB4CKD0': { cat: 'equipment', id: 'back-window' },
  '3QH3473D': { cat: 'equipment', id: 'heated-seats' },
  '3QP3RF3C': { cat: 'equipment', id: 'perfectvan-toilet' },
  '3QCL354N': { cat: 'equipment', id: 'clesana-toilet' },
  '3Q7RUM44': { cat: 'equipment', id: 'truma-4de' },
  '3Q4LUWH3': { cat: 'equipment', id: 'alu-wheels' },
  '3QR00F4C': { cat: 'equipment', id: 'roof-ac' },
  '3Q4L4RM7': { cat: 'equipment', id: 'alarm-premium' },
  '3Q7H17R0': { cat: 'equipment', id: 'profinder' },
  '3Q4L4DTB': { cat: 'equipment', id: 'alarm-standard' },
  // Transport
  '7R4N5P0R': { cat: 'transport', id: 'transport' }
};

// Also build reverse lookup: "models/regular" → "P3GR3G"
const ID_TO_CODE = {};
for (const [code, ref] of Object.entries(CODE_MAP)) {
  ID_TO_CODE[ref.cat + '/' + ref.id] = code;
}

const DATA = {
  models: [
    { id: 'regular', name: 'REGULAR', price: 99790, code: 'P3GR3G', hp: '150 HP', trans: 'Manual transmission',
      desc: 'Pegasus Base',
      features: ['New Womondo Bathroom','New swivelling table','Rearview camera','Radio with Android Auto & Apple CarPlay','Truma 4D heating','Robeta Air Furniture','Driver compartment blackout','Awning','135 Ah Lithium battery','Solar package with inverter & 130 Wp solar panel','Maxxfan in the sleeping area'] },
    { id: 'pro', name: 'PRO', price: 115390, code: 'P3GPR0', hp: '150 HP', trans: 'Automatic transmission',
      desc: 'Pegasus PRO',
      features: ['Active Brake Assist','93-litre main fuel tank','Longitudinal beam reinforcement','High-performance LED headlights','Exit & reversing lights underneath','Electrically operated right sliding door','Heat-insulated front windscreen','Painted bumper & corners','Cooling grille in vehicle colour','Driver & passenger seat heating','Leather steering wheel','Acoustic package','Additional warm air heating, electric','Automatic air conditioning Thermotronic','Digital radio (DAB)','Parking kit with 360\u00b0 camera','Multifunction steering wheel','Blind Spot Assist','Active Lane Keep Assist','Active Distance Assist DISTRONIC (ACC)','Rain sensor','Low-beam Assist','Wireless remote control multi-function keys','Live traffic information (pre-wiring)'] }
  ],
  upgrades: [
    { id: 'auto-gearbox', name: 'Automatic gearbox', price: 2999, code: 'UP4U70', requires: [], requiresModel: null },
    { id: '190hp', name: '190 hp upgrade (only with automatic gearbox)', price: 4299, code: 'UP190HP', requires: ['auto-gearbox'], requiresModel: null },
    { id: '4x4', name: '4\u00d74 drive option (only with automatic, 190 hp and PRO)', price: 8499, code: 'UP4X4', requires: ['auto-gearbox', '190hp'], requiresModel: 'pro' },
    { id: 'airmatic', name: 'AIRMATIC air suspension Mercedes-Benz', price: 4099, code: 'UP41RM47', requires: [], requiresModel: null }
  ],
  colours: [
    { id: 'selenit-grey', name: 'Selenit Grey', price: 1999, code: 'C0L53L3N', hex: '#7C7D7E' },
    { id: 'tenorit-grey', name: 'Tenorit Grey', price: 1999, code: 'C0L73N0R', hex: '#6E6E6E' },
    { id: 'obsidian-black', name: 'Obsidian Black', price: 1999, code: 'C0L0B51D', hex: '#1C1C1C' },
    { id: 'blue-grey', name: 'Blue Grey', price: 899, code: 'C0LBLU3G', hex: '#6B7B8D' },
    { id: 'pebble-grey', name: 'Pebble Grey', price: 899, code: 'C0LP3BBL', hex: '#B0AFA7' },
    { id: 'white', name: 'White (standard)', price: 0, code: 'C0LWH173', hex: '#F5F5F5' }
  ],
  packages: [
    { id: 'popup-roof', name: 'POP-UP roof (extra sleeping area \u2014 double bed 120\u00d7200 with mattress)', price: 9899, code: 'PKGP0PUP' },
    { id: 'smart-tv', name: 'Smart TV package (Smart TV / bracket / 4G LTE antenna + router kit)', price: 1999, code: 'PKG5M4R7' },
    { id: 'winter', name: 'Winter Package (Truma 6D + 2kW electric heating, high altitude setup, partly insulated driver cabin, heated grey water tank)', price: 1499, code: 'PKGW1N73' },
    { id: 'offroad', name: 'Off Road Pack', price: 8999, code: 'PKG0FFR0' },
    { id: 'offroad-popup', name: 'Off Road pack with Pop-up Roof (pop-up roof not included)', price: 6999, code: 'PKG0FCL5' },
    { id: 'side-extension', name: 'Side extension sleeping area (left + right)', price: 3999, code: '0P751D33' },
    { id: 'airline', name: 'Airline system', price: 0, code: '0P741RL1' }
  ],
  equipment: [
    { id: 'ext-gas', name: 'External gas connection', price: 249, code: '3Q3X7G45' },
    { id: 'ext-shower', name: 'External hot & cold shower connection', price: 249, code: '3Q3X75H0' },
    { id: 'isofix', name: 'Isofix', price: 249, code: '3Q150F1X' },
    { id: 'tow-hook', name: 'Tow hook', price: 1099, code: '3Q70WH00' },
    { id: 'extra-bed', name: 'Extra bed in the dining area', price: 999, code: '3Q3X7R4B' },
    { id: 'grey-tank-heat', name: 'Heating of grey water tank', price: 499, code: '3QGR3YW4' },
    { id: 'back-window', name: 'Back door window 500\u00d7450 (per side)', price: 489, code: '3QB4CKD0' },
    { id: 'heated-seats', name: 'Heated seats', price: 599, code: '3QH3473D' },
    { id: 'perfectvan-toilet', name: 'PerfectVan separation toilet', price: 2089, code: '3QP3RF3C' },
    { id: 'clesana-toilet', name: 'Clesana toilet', price: 2199, code: '3QCL354N' },
    { id: 'truma-4de', name: 'Truma 4DE heating', price: 599, code: '3Q7RUM44' },
    { id: 'alu-wheels', name: '16" ALU wheels (Dezent KH BLACK)', price: 1399, code: '3Q4LUWH3' },
    { id: 'roof-ac', name: '2200W roof air conditioner', price: 2499, code: '3QR00F4C' },
    { id: 'alarm-premium', name: 'Premium alarm system Thitronik', price: 1099, code: '3Q4L4RM7' },
    { id: 'profinder', name: 'Thitronik Profinder', price: 699, code: '3Q7H17R0' },
    { id: 'alarm-standard', name: 'Thitronik standard alarm system \u2014 door only', price: 799, code: '3Q4L4DTB' }
  ],
  transport: { id: 'transport', name: 'Transport costs', price: 1789, code: '7R4N5P0R' }
};

const STEPS = [
  { num: 1, label: 'Model' },
  { num: 2, label: 'Upgrades' },
  { num: 3, label: 'Colour' },
  { num: 4, label: 'Packages' },
  { num: 5, label: 'Equipment' }
];

// ─────────────────────────────────────
// 2. SHEET / CSV
// ─────────────────────────────────────
const sheet = {
  loaded: false,
  headerRaw: [],
  headerUp: [],
  tableRows: [],
  byCol: new Map()  // colKey → { colIndex, map: Map<MO_CODE, price> }
};

function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      inQuotes = !inQuotes; i++; continue;
    }
    if (!inQuotes && (c === ',' || c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (c === '\n' || c === '\r') {
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      }
      i++; continue;
    }
    field += c; i++;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

const up = (s) => (s || '').toString().replace(/\u00a0/g, ' ').trim().toUpperCase();
const normHeader = (h) => up(h).replace(/[^A-Z0-9]/g, '');

function parseNumberLoose(val) {
  if (val == null) return NaN;
  const s = val.toString().replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

async function loadSheet() {
  if (!CSV_URL) { log('No csvUrl — using hardcoded prices'); return; }
  try {
    const res = await fetch(CSV_URL + (CSV_URL.includes('?') ? '&' : '?') + '_ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);
    const csv = await res.text();
    const table = parseCSV(csv);
    if (!table.length) throw new Error('CSV empty');

    sheet.headerRaw = table[0];
    sheet.headerUp = sheet.headerRaw.map(h => up(h));
    sheet.tableRows = table.slice(1);

    const codeIdx = sheet.headerUp.indexOf('MO_CODE');
    if (codeIdx < 0) throw new Error('CSV must contain MO_CODE header');

    const META = new Set(['MO_CODE','MODEL','BRAND','TRANS','ENGINE','PRICE','DESCRIPTION']);
    sheet.byCol.clear();

    sheet.headerRaw.forEach((h, colIndex) => {
      const H = up(h);
      if (colIndex === codeIdx) return;
      if (META.has(H)) return;

      const colKey = normHeader(h);
      const map = new Map();
      for (const r of sheet.tableRows) {
        const code = up(r[codeIdx]);
        const gross = parseNumberLoose(r[colIndex]);
        if (code && Number.isFinite(gross) && gross >= 0) map.set(code, gross);
      }
      sheet.byCol.set(colKey, { colIndex, map });
    });

    sheet.loaded = true;
    log('Sheet loaded. Columns:', [...sheet.byCol.keys()]);

    // Apply DE prices from sheet on load
    applySheetPrices('DE');
  } catch (err) {
    console.warn('[PEGASUS] Sheet load error:', err);
    log('Falling back to hardcoded prices');
  }
}

function applySheetPrices(colKey) {
  const col = sheet.byCol.get(normHeader(colKey));
  if (!col) { log('Column not found:', colKey); return; }

  state.countryCol = normHeader(colKey);

  // Walk all DATA categories and update .price from sheet
  for (const [code, ref] of Object.entries(CODE_MAP)) {
    const sheetPrice = col.map.get(code);
    if (!Number.isFinite(sheetPrice)) continue;

    if (ref.cat === 'transport') {
      DATA.transport.price = sheetPrice;
      continue;
    }
    const list = DATA[ref.cat];
    if (!list) continue;
    const item = list.find(x => x.id === ref.id);
    if (item) item.price = sheetPrice;
  }

  log('Prices applied for column:', colKey);
}

// ─────────────────────────────────────
// 3. STATE
// ─────────────────────────────────────
const state = {
  model: null,
  upgrades: new Set(),
  colour: null,
  packages: new Set(),
  equipment: new Set(),
  step: 1,
  formVisible: false,
  submitted: false,
  country: 'Germany',
  countryCol: 'DE'
};

// ─────────────────────────────────────
// 4. HELPERS
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

function switchCountry(countryLabel) {
  const colKey = COUNTRY_MAP[countryLabel];
  if (!colKey) return;
  state.country = countryLabel;
  state.countryCol = colKey;

  if (sheet.loaded) {
    applySheetPrices(colKey);
  }
  renderAll();

  // ── Bridge to Webflow native form country field ──
  syncCountryToWebflow(countryLabel);

  log('Switched to', countryLabel, '→', colKey);
}

/** Push the configurator's country into the Webflow native form so embedded
 *  scripts (EU dropdown, phone prefix, dealer auto-assign) pick it up. */
function syncCountryToWebflow(countryLabel) {
  try {
    // 1. Native Webflow form hidden input (.field-country / #Country)
    const wfCountryInput = document.querySelector('.conf-email-form #Country') ||
                           document.querySelector('.conf-email-form .field-country input') ||
                           document.querySelector('.conf-email-form [name="Country"]');
    if (wfCountryInput) {
      wfCountryInput.value = countryLabel;
      wfCountryInput.dispatchEvent(new Event('input', { bubbles: true }));
      wfCountryInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 2. EU select (created by embedded script replacing .field-country)
    const wfEuSelect = document.querySelector('.conf-email-form select[data-eu-country]');
    if (wfEuSelect) {
      // find matching option
      const opt = Array.from(wfEuSelect.options).find(o =>
        o.value.toLowerCase() === countryLabel.toLowerCase() ||
        o.textContent.trim().toLowerCase() === countryLabel.toLowerCase()
      );
      if (opt) {
        wfEuSelect.value = opt.value;
        wfEuSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 3. Also sync to the modal form's own EU select + hidden country input
    const modalEuSelect = document.querySelector('#pgc-contact-form #Country-select, #pgc-contact-form select[data-eu-country]');
    if (modalEuSelect) {
      const opt2 = Array.from(modalEuSelect.options).find(o =>
        o.value.toLowerCase() === countryLabel.toLowerCase()
      );
      if (opt2 && modalEuSelect.value !== opt2.value) {
        modalEuSelect.value = opt2.value;
        modalEuSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    const modalCountryHidden = document.querySelector('#pgc-contact-form #Country');
    if (modalCountryHidden) {
      modalCountryHidden.value = countryLabel;
    }

    log('Country synced to Webflow form:', countryLabel);
  } catch (e) {
    log('Country sync error (non-critical):', e);
  }
}

// ─────────────────────────────────────
// 4b. PHONE PREFIX + VALIDATION
// ─────────────────────────────────────
function getDialCode(countryLabel) {
  return DIAL[(countryLabel || '').trim().toUpperCase()] || null;
}

function swapPhonePrefix(input, dial) {
  if (!dial) return;
  const rest = (input.value || '').replace(/^\+\d+(?:\s)?/, '');
  const next = dial + (rest ? ' ' + rest.replace(/^\s+/, '') : ' ');
  if (input.value !== next) {
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function strongSanitizePhone(input) {
  let raw = String(input.value || '').replace(/[^+\d]/g, '');
  let dial = getDialCode(state.country);
  if (!dial) {
    const m = raw.match(/^\+\d{1,4}/);
    dial = m ? m[0] : '+';
  }
  let userPart;
  if (raw.startsWith(dial)) { userPart = raw.slice(dial.length); }
  else { userPart = raw.replace(/^\+\d{1,4}/, ''); }
  userPart = userPart.replace(/\D/g, '');
  input.value = dial + (userPart ? ' ' + userPart : ' ');
}

function phoneDigitsCount(v) { return (v || '').replace(/\D/g, '').length; }
function isPhoneValid(v) {
  if (!/^\+\d/.test(v || '')) return false;
  const d = phoneDigitsCount(v);
  return d >= 8 && d <= 15;
}

function showFieldError(input, msgClass, text) {
  const msg = input.parentElement && input.parentElement.querySelector('.' + msgClass);
  if (msg) { msg.textContent = text; msg.style.display = 'block'; }
  input.classList.add('is-invalid');
}
function clearFieldError(input, msgClass) {
  const msg = input.parentElement && input.parentElement.querySelector('.' + msgClass);
  if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
  input.classList.remove('is-invalid');
}

function validatePhoneField(input, showErr) {
  strongSanitizePhone(input);
  const ok = isPhoneValid(input.value);
  if (!ok && showErr) showFieldError(input, 'field-phone-msg', 'Please enter a valid phone number (e.g., +386 40123456).');
  else if (ok) clearFieldError(input, 'field-phone-msg');
  return ok;
}

// ─────────────────────────────────────
// 4c. EMAIL VALIDATION
// ─────────────────────────────────────
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function isEmailValid(v) {
  v = (v || '').trim();
  if (!EMAIL_REGEX.test(v)) return false;
  if (v.includes('..')) return false;
  const domain = v.split('@')[1];
  if (!domain) return false;
  return !domain.split('.').some(lbl => !lbl || lbl.startsWith('-') || lbl.endsWith('-'));
}

function validateEmailField(input, showErr) {
  const ok = isEmailValid(input.value);
  if (!ok && showErr) showFieldError(input, 'field-email-msg', 'Please enter a valid email address (e.g., name@example.com).');
  else if (ok) clearFieldError(input, 'field-email-msg');
  return ok;
}

// ─────────────────────────────────────
// 4d. DEALER AUTO-ASSIGN (Haversine + Nominatim)
// ─────────────────────────────────────
function isValidPostal(country, code) {
  if (!country || !code) return false;
  const pattern = POSTAL_PATTERNS[country.trim()];
  if (!pattern) return code.trim().length >= 3;
  return pattern.test(code.trim());
}

function loadDealersFromDom() {
  return Array.from(document.querySelectorAll('.dealer-record'))
    .map(el => ({
      name: (el.getAttribute('data-dealer-name') || '').trim(),
      country: (el.getAttribute('data-dealer-country') || '').trim(),
      lat: parseFloat(el.getAttribute('data-dealer-lat')),
      lng: parseFloat(el.getAttribute('data-dealer-lng')),
      city: (el.getAttribute('data-dealer-city') || '').trim()
    }))
    .filter(d => d.name && !isNaN(d.lat) && !isNaN(d.lng));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function geocodePostal(country, postal) {
  const url = 'https://nominatim.openstreetmap.org/search?q=' +
    encodeURIComponent(postal + ' ' + country) + '&format=json&limit=1';
  return fetch(url, { headers: { 'Accept': 'application/json' } })
    .then(r => r.json())
    .then(data => {
      if (!data || !data.length) throw new Error('no geocode result');
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    });
}

let dealerAssignTimer = null;
function triggerDealerAutoAssign(countryVal, zipVal, assignedField) {
  clearTimeout(dealerAssignTimer);
  dealerAssignTimer = setTimeout(() => {
    const country = (countryVal || '').trim();
    const postal = (zipVal || '').trim();
    if (!country || !postal || !isValidPostal(country, postal)) {
      assignedField.value = '';
      return;
    }
    assignedField.value = 'Finding nearest dealer\u2026';

    const dealers = loadDealersFromDom();
    if (!dealers.length) {
      log('Dealer auto-assign: no .dealer-record elements in DOM');
      assignedField.value = '';
      return;
    }

    geocodePostal(country, postal)
      .then(pos => {
        const normC = country.toLowerCase();
        let pool = dealers.filter(d => d.country.toLowerCase() === normC);
        if (!pool.length) pool = dealers;

        let best = null, bestDist = Infinity;
        pool.forEach(d => {
          const km = haversineKm(pos.lat, pos.lng, d.lat, d.lng);
          if (km < bestDist) { bestDist = km; best = d; }
        });

        if (best) {
          assignedField.value = best.name +
            (best.city ? ' \u2014 ' + best.city : '') +
            ' \u2014 ' + Math.round(bestDist) + ' km';
        } else {
          assignedField.value = '';
        }
      })
      .catch(() => { assignedField.value = ''; });
  }, 600);
}

// ─────────────────────────────────────
// 5. CSS INJECTION
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
.pgc-total-bar{position:sticky;bottom:0;background:#111;border-top:1px solid #333;padding:16px 30px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:10;flex-wrap:wrap}
.pgc-total-left{display:flex;align-items:center;gap:12px;flex-shrink:0}
.pgc-total-label{font-size:14px;color:#888}
.pgc-total-price{font-size:22px;font-weight:800;color:#fff;flex:1;text-align:right;padding-right:16px;white-space:nowrap}
.pgc-country-select{background:#222;color:#fff;border:2px solid #444;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:600;cursor:pointer;outline:none;transition:border-color .2s;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23999' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
.pgc-country-select:focus{border-color:rgb(161,113,90)}
.pgc-nav-btns{display:flex;gap:10px}
.pgc-btn{padding:12px 28px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;text-transform:uppercase;letter-spacing:.03em}
.pgc-btn-primary{background:rgb(161,113,90);color:#fff}
.pgc-btn-primary:hover{background:rgb(181,133,110)}
.pgc-btn-secondary{background:#333;color:#ccc}
.pgc-btn-secondary:hover{background:#444}
.pgc-form{max-width:480px;margin:0 auto}
.pgc-form h3{font-size:20px;font-weight:700;margin-bottom:8px;color:rgb(161,113,90)}
.pgc-form p{font-size:14px;color:#888;margin-bottom:24px}
.pgc-form input,.pgc-form select,.pgc-form textarea{width:100%;padding:14px 16px;border:2px solid #333;border-radius:8px;background:#222;color:#fff !important;-webkit-text-fill-color:#fff !important;font-size:14px;margin-bottom:12px;box-sizing:border-box;outline:none;transition:border-color .2s}
.pgc-form input:focus,.pgc-form select:focus{border-color:rgb(161,113,90) !important;box-shadow:none !important}
.pgc-form input::placeholder{color:#666 !important;-webkit-text-fill-color:#666 !important}
.pgc-form select{appearance:none;-webkit-appearance:none}
.pgc-form .field-email,.pgc-form .field-country,.pgc-form .field-phone{display:contents}
.pgc-form .field-email-msg,.pgc-form .field-phone-msg{margin-top:-8px;margin-bottom:8px;font-size:12px;line-height:1.3;color:#ff6b6b;display:none}
.pgc-form .is-invalid{border-color:#ff6b6b !important}
.pgc-form .pgc-textarea-visible{width:100%;min-height:120px;max-height:260px;resize:vertical;padding:12px 14px;border:2px solid #333;border-radius:8px;background:#1e1e1e;color:#aaa !important;-webkit-text-fill-color:#aaa !important;font-size:12px;line-height:1.5;margin-bottom:12px;box-sizing:border-box;font-family:monospace;cursor:default}
.pgc-form .pgc-dealer-field{width:100%;padding:14px 16px;border:2px solid #333;border-radius:8px;background:#1e1e1e;color:#ccc !important;-webkit-text-fill-color:#ccc !important;font-size:13px;margin-bottom:12px;box-sizing:border-box;cursor:default}
.pgc-form .pgc-field-label{font-size:12px;color:#666;margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.03em}
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
.pgc-total-bar{padding:12px 16px}
.pgc-total-price{font-size:18px;padding-right:8px}
.pgc-nav-btns{width:100%;justify-content:stretch}
.pgc-nav-btns .pgc-btn{flex:1}
.pgc-form-row{flex-direction:column;gap:0}
.pgc-country-select{width:100%;margin-bottom:8px}
}
`;
  document.head.appendChild(style);
}

// ─────────────────────────────────────
// 6. MODAL STRUCTURE
// ─────────────────────────────────────
let modalEl = null;
let contentEl = null;
let stepperEl = null;
let totalPriceEl = null;
let navBtnsEl = null;
let countrySelectEl = null;

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
        <div class="pgc-total-left">
          <span class="pgc-total-label">Total (incl. VAT)</span>
          <select class="pgc-country-select" aria-label="Country">
            ${COUNTRY_LIST.map(c => `<option value="${esc(c)}"${c === 'Germany' ? ' selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
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
  countrySelectEl = overlay.querySelector('.pgc-country-select');

  // Country switcher
  countrySelectEl.addEventListener('change', () => {
    switchCountry(countrySelectEl.value);
  });

  overlay.querySelector('.pgc-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('pgc-open')) closeModal(); });
}

function openModal() {
  resetState();
  // Sync country select with state
  if (countrySelectEl) countrySelectEl.value = state.country;
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
  // Keep country as-is (don't reset on re-open)
}

// ─────────────────────────────────────
// 7. RENDER
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
// 8. FORM  (HubSpot-connected)
// ─────────────────────────────────────
function renderForm() {
  const summaryText = buildSummaryText();
  const dial = getDialCode(state.country) || '+49';

  // Build EU country <option> list
  const euOpts = EU_COUNTRIES.map(c =>
    `<option value="${esc(c)}"${c === state.country ? ' selected' : ''}>${esc(c)}</option>`
  ).join('');

  contentEl.innerHTML = `
    <div class="pgc-form conf-email-form">
      <h3>Get your configuration</h3>
      <p>Leave your contact details so we can send you the configuration and say hello.</p>
      <form id="pgc-contact-form"
            action="${esc(HUBSPOT_FORM_URL)}"
            method="POST"
            enctype="multipart/form-data"
            novalidate>

        <div class="pgc-form-row">
          <input type="text" name="First Name" id="First-Name" placeholder="First name *" required />
          <input type="text" name="Last Name" id="Last-Name" placeholder="Last name *" required />
        </div>

        <div class="field-email">
          <input type="email" name="Email" id="Email" placeholder="Email *" required inputmode="email" autocomplete="email" />
          <div class="field-email-msg"></div>
        </div>

        <div class="pgc-form-row">
          <div class="field-country" style="flex:1">
            <select id="Country-select" data-eu-country="1" aria-label="Country (EU only)" required>
              <option value="" disabled>Select your country</option>
              ${euOpts}
            </select>
            <input type="hidden" name="Country" id="Country" value="${esc(state.country)}" />
          </div>
          <input type="text" name="ZIP CODE" id="ZIP-CODE" placeholder="Zip Code *" style="flex:1" required />
        </div>

        <div class="field-phone">
          <input type="tel" name="Phone number" id="Phone-number" placeholder="Phone Number *" required inputmode="tel" value="${esc(dial)} " />
          <div class="field-phone-msg"></div>
        </div>

        <!-- Configuration summary (visible, read-only) -->
        <span class="pgc-field-label">Customer's configuration and price</span>
        <textarea name="textarea field" class="textarea-field pgc-textarea-visible" id="textarea-field" readonly>${esc(summaryText)}</textarea>

        <!-- Assigned dealer (visible, read-only, auto-populated) -->
        <span class="pgc-field-label">Assigned dealer</span>
        <input type="text" name="assigned dealer" id="assigned-dealer" class="pgc-dealer-field" value="" readonly placeholder="Will be auto-assigned based on your location" />

        <!-- HubSpot tracking (hidden) -->
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
  const countrySelect = form.querySelector('#Country-select');
  const countryHidden = form.querySelector('#Country');
  const zipField = form.querySelector('#ZIP-CODE');
  const phoneInput = form.querySelector('#Phone-number');
  const emailInput = form.querySelector('#Email');
  const assignedField = form.querySelector('#assigned-dealer');

  // Fill HubSpot tracking hidden fields
  try {
    form.querySelector('[name="pageUri"]').value = window.location.href;
    form.querySelector('[name="pageName"]').value = document.title;
    form.querySelector('[name="pageId"]').value = '69674f7a8346b86879ce8dbc';
    const hutk = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('hubspotutk='));
    if (hutk) form.querySelector('[name="hutk"]').value = hutk.split('=')[1];
  } catch (e) { /* optional */ }

  // ── EU Country select → sync to hidden input + phone prefix + dealer ──
  countrySelect.addEventListener('change', () => {
    const val = countrySelect.value;
    countryHidden.value = val;
    countryHidden.dispatchEvent(new Event('input', { bubbles: true }));

    // Update phone prefix
    const newDial = getDialCode(val);
    if (newDial) swapPhonePrefix(phoneInput, newDial);
    strongSanitizePhone(phoneInput);

    // Trigger dealer auto-assign
    triggerDealerAutoAssign(val, zipField.value, assignedField);
  });

  // ── ZIP field → trigger dealer auto-assign ──
  zipField.addEventListener('input', () => {
    triggerDealerAutoAssign(countrySelect.value, zipField.value, assignedField);
  });
  zipField.addEventListener('change', () => {
    triggerDealerAutoAssign(countrySelect.value, zipField.value, assignedField);
  });

  // ── Phone input: restrict to digits + prefix, validate ──
  phoneInput.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(k)) return;
    if (k === ' ') { e.preventDefault(); return; }
    if (k === '+') {
      if ((phoneInput.value || '').includes('+') || phoneInput.selectionStart !== 0) e.preventDefault();
      return;
    }
    if (/\d/.test(k)) return;
    e.preventDefault();
  });
  phoneInput.addEventListener('input', () => validatePhoneField(phoneInput, false));
  phoneInput.addEventListener('blur', () => validatePhoneField(phoneInput, true));
  phoneInput.addEventListener('focus', () => {
    if (!/^\+\d/.test(phoneInput.value || '')) {
      const d = getDialCode(countrySelect.value);
      if (d) swapPhonePrefix(phoneInput, d);
      strongSanitizePhone(phoneInput);
    }
  });

  // ── Email validation ──
  emailInput.addEventListener('input', () => validateEmailField(emailInput, false));
  emailInput.addEventListener('blur', () => validateEmailField(emailInput, true));

  // ── Form submit ──
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit(form);
  });

  // ── Auto-trigger dealer assign if country + zip already filled ──
  if (countrySelect.value && zipField.value) {
    triggerDealerAutoAssign(countrySelect.value, zipField.value, assignedField);
  }

  log('Form rendered with EU dropdown, phone prefix, email validation, dealer auto-assign');
}

function handleFormSubmit(form) {
  const fd = new FormData(form);
  const firstname = (fd.get('First Name') || '').toString().trim();
  const lastname = (fd.get('Last Name') || '').toString().trim();
  const emailInput = form.querySelector('#Email');
  const phoneInput = form.querySelector('#Phone-number');
  const email = (emailInput ? emailInput.value : '').trim();
  const consentRequired = form.querySelector('[name="895486508"]');

  if (!firstname || !lastname) { alert('Please enter your first and last name.'); return; }

  // Validate email
  if (!isEmailValid(email)) {
    validateEmailField(emailInput, true);
    emailInput.focus();
    return;
  }

  // Validate phone
  if (phoneInput && !isPhoneValid(phoneInput.value)) {
    validatePhoneField(phoneInput, true);
    phoneInput.focus();
    return;
  }

  if (consentRequired && !consentRequired.checked) { alert('Please agree to the contact consent to continue.'); return; }

  const submitBtn = form.querySelector('.pgc-form-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'SUBMITTING...'; }

  // Read values from the modal form
  const phone = (phoneInput || {}).value || '';
  const countrySelect = form.querySelector('#Country-select');
  const country = (countrySelect ? countrySelect.value : '') ||
                  (form.querySelector('#Country') || {}).value || state.country;
  const zip = (form.querySelector('#ZIP-CODE') || {}).value || '';
  const assignedDealer = (form.querySelector('#assigned-dealer') || {}).value || '';

  // Sync hidden country input
  const countryHidden = form.querySelector('#Country');
  if (countryHidden) countryHidden.value = country;

  // Refresh the summary text with latest state
  const summaryText = buildSummaryText();
  const textareaEl = form.querySelector('.textarea-field');
  if (textareaEl) textareaEl.value = summaryText;

  const contact = {
    firstName: firstname,
    lastName: lastname,
    email,
    phone: phone.trim(),
    country: country.trim(),
    zip: zip.trim(),
    assignedDealer: assignedDealer.trim()
  };

  // ── 1) Bridge to native Webflow form & submit it ──
  bridgeAndSubmitWebflowForm(contact, summaryText, assignedDealer);

  // ── 2) Direct HubSpot POST ──
  submitToHubSpot(contact, summaryText, assignedDealer).then(() => {
    log('Direct HubSpot form submitted');
  }).catch(err => {
    console.warn('[PEGASUS] Direct HubSpot submit error:', err);
  });

  // ── 3) Webhook (backup) ──
  const payload = buildPayload(contact);
  postWebhook(payload);

  state.submitted = true;
  renderAll();
}

/** Fill the native Webflow form (.conf-email-form on the page behind the modal)
 *  with all the values from the configurator and programmatically submit it.
 *  This ensures the data flows through Webflow → HubSpot + Email Notifications + Pipedream. */
function bridgeAndSubmitWebflowForm(contact, summaryText, assignedDealer) {
  try {
    const wfForm = document.querySelector('.conf-email-form:not(#pgc-contact-form):not(.pgc-form)') ||
                   document.querySelector('form[data-name="Womondo Configurator Dealer"]');
    if (!wfForm) {
      // Try finding it as a parent wrapper
      const wrapper = document.querySelector('div.conf-email-form');
      const inner = wrapper ? wrapper.querySelector('form') : null;
      if (!inner) { log('Native Webflow form not found — skipping bridge'); return; }
      fillAndSubmitForm(inner, contact, summaryText, assignedDealer);
      return;
    }
    // If wfForm is a <form>, use it directly; if it's a wrapper div, find the form inside
    const actualForm = wfForm.tagName === 'FORM' ? wfForm : wfForm.querySelector('form');
    if (!actualForm) { log('Native Webflow <form> not found inside wrapper'); return; }
    fillAndSubmitForm(actualForm, contact, summaryText, assignedDealer);
  } catch (err) {
    console.warn('[PEGASUS] Bridge to Webflow form error:', err);
  }
}

function fillAndSubmitForm(form, contact, summaryText, assignedDealer) {
  // Helper: set a field's value and fire events
  function setField(selector, value) {
    const el = form.querySelector(selector);
    if (!el) return false;
    el.value = value || '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // Fill visible fields
  setField('#First-Name, [name="First Name"]', contact.firstName);
  setField('#Last-Name, [name="Last Name"]', contact.lastName);
  setField('#Email, .field-email input, [name="Email"]', contact.email);
  setField('#Phone-number, .field-phone input, [name="Phone number"]', contact.phone);
  setField('#ZIP-CODE, [name="ZIP CODE"]', contact.zip);

  // Country: try EU select first, then text input
  const euSelect = form.querySelector('select[data-eu-country]');
  if (euSelect && contact.country) {
    const opt = Array.from(euSelect.options).find(o =>
      o.value.toLowerCase() === contact.country.toLowerCase() ||
      o.textContent.trim().toLowerCase() === contact.country.toLowerCase()
    );
    if (opt) {
      euSelect.value = opt.value;
      euSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  setField('#Country, .field-country input, [name="Country"]', contact.country);

  // Hidden fields
  setField('.textarea-field, #textarea-field, [name="textarea field"]', summaryText);
  setField('#assigned-dealer, [name="assigned dealer"]', assignedDealer);

  log('Webflow form fields populated — submitting...');

  // Programmatically submit the native Webflow form
  // Use requestSubmit() if available (respects form handlers), else .submit()
  setTimeout(() => {
    try {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
      log('Webflow native form submitted');
    } catch (e) {
      console.warn('[PEGASUS] Webflow form submit error:', e);
      // Fallback: click the submit button
      const btn = form.querySelector('[type="submit"], .conf-submit-button-form, button');
      if (btn) btn.click();
    }
  }, 200); // small delay to let dealer auto-assign finish
}

async function submitToHubSpot(contact, summaryText, assignedDealer) {
  try {
    // Build form data with HubSpot field names
    const formData = new FormData();
    formData.append('firstname', contact.firstName);
    formData.append('lastname', contact.lastName);
    formData.append('email', contact.email);
    formData.append('phone', contact.phone);
    formData.append('country', contact.country);
    formData.append('zip', contact.zip);
    formData.append('customes_configuration_and_price', summaryText);
    formData.append('assigned_dealer', assignedDealer);

    // Consent fields
    formData.append('895486508', '895486508');
    // HubSpot tracking
    formData.append('pageUri', window.location.href);
    formData.append('pageName', document.title);
    formData.append('pageId', '69674f7a8346b86879ce8dbc');
    try {
      const hutk = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('hubspotutk='));
      if (hutk) formData.append('hutk', hutk.split('=')[1]);
    } catch (_) {}

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
// 9. PAYLOAD + WEBHOOK
// ─────────────────────────────────────
function buildSummaryText() {
  const lines = [];
  lines.push('=== PEGASUS CONFIGURATION ===');
  lines.push('Date: ' + new Date().toLocaleDateString('de-DE'));
  lines.push('Country: ' + state.country + ' (' + state.countryCol + ')');
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
    country: state.country,
    countryCol: state.countryCol,
    contact,
    assignedDealer: contact.assignedDealer || '',
    configuration: {
      model: state.model,
      modelName: model ? model.name : null,
      modelPrice: model ? model.price : 0,
      upgrades: [...state.upgrades].map(id => {
        const u = DATA.upgrades.find(x => x.id === id);
        return { id, name: u?.name, price: u?.price || 0, code: u?.code };
      }),
      colour: state.colour ? (() => {
        const c = DATA.colours.find(x => x.id === state.colour);
        return { id: state.colour, name: c?.name, price: c?.price || 0, code: c?.code };
      })() : null,
      packages: [...state.packages].map(id => {
        const p = DATA.packages.find(x => x.id === id);
        return { id, name: p?.name, price: p?.price || 0, code: p?.code };
      }),
      equipment: [...state.equipment].map(id => {
        const e = DATA.equipment.find(x => x.id === id);
        return { id, name: e?.name, price: e?.price || 0, code: e?.code };
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
// 10. SUCCESS + PDF
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
    y = textW('Country: ' + state.country + ' (' + state.countryCol + ')', MX, y, maxW, 11, false);
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
// 11. INIT
// ─────────────────────────────────────
async function initialize() {
  injectStyles();
  createModal();

  // Load Google Sheet prices (async, non-blocking)
  await loadSheet();

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
