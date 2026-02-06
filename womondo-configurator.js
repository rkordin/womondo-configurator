/* womondo-configurator.js */
(() => {
  'use strict';

  // -----------------------------
  // CONFIG (from window.WOMONDO_CFG)
  // -----------------------------
  const CFG = window.WOMONDO_CFG || {};
  const CSV_URL = CFG.csvUrl || '';
  const WEBHOOK_URL = CFG.webhookUrl || '';
  const DEBUG = !!CFG.debug;

  const TRANSPORT_PRIMARY = (CFG.transportCodePrimary || 'WOTRANS').toString().trim().toUpperCase();
  const TRANSPORT_TRIGGER_CODES = (CFG.transportTriggerCodes || ['LENG0L2','LENG0L3','LENG0L4'])
    .map(s => (s || '').toString().trim().toUpperCase());
  const TRANSPORT_LABEL = 'Transport and documents cost';

  // Dropdown label -> sheet column header
  const COUNTRY_TO_SHEET_COL = {
    'GERMANY': 'DE','AUSTRIA': 'AT','BELGIUM': 'BE','BULGARIA': 'BG','CROATIA': 'HR','CYPRUS': 'CY',
    'CZECH REPUBLIC': 'CZ','DENMARK': 'DK','ESTONIA': 'EE','FINLAND': 'FI','FRANCE': 'FR','GREECE': 'GR',
    'HUNGARY': 'HU','ITALY': 'IT','NETHERLANDS': 'NL','POLAND': 'PL','PORTUGAL': 'PT','ROMANIA': 'RO',
    'SLOVENIA': 'SI','SPAIN': 'ES','SWEDEN': 'SE'
  };

  // -----------------------------
  // STATE
  // -----------------------------
  let currentCountry = 'GERMANY';
  let currentCountryColKey = 'DE';

  let selectedItems = {};      // { cardId: { title, priceGross, row } }
  let selectedSubOptions = {}; // { cardId: { title, priceGross } }
  let selectedModel = null;
  let baseTotalGross = 0;

  window.selectedExtras = window.selectedExtras || {};
  let autoFees = {}; // { CODE: { name, code, priceGross } }

  const selectionRules = {
    0: 1,
    1: 1,
    2: 'multiple',
    3: 'multiple',
    4: 1
  };

  // -----------------------------
  // HELPERS
  // -----------------------------
  const fmtEUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const log = (...a) => { if (DEBUG) console.log('[WOMONDO]', ...a); };

  const up = (s) => (s || '').toString().replace(/\u00a0/g, ' ').trim().toUpperCase();

  function formatEuro(n) {
    const v = Number.isFinite(n) ? n : 0;
    return fmtEUR.format(v);
  }

  function parseNumberLoose(val) {
    if (val == null) return NaN;
    const s = val.toString()
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function extractCode(raw) {
    if (!raw) return null;
    let s = raw.toString().replace(/\u00a0/g, ' ').trim().toUpperCase();
    s = s.replace(/^\+/, '').trim();
    if (!s) return null;
    if (s.includes('€')) return null;
    if (/^\d+([.,]\d+)?$/.test(s)) return null;

    // IMPORTANT: allow codes with 0 inside
    const m = s.match(/[A-Z][A-Z0-9_]{3,}/);
    return m ? m[0] : null;
  }

  function normHeader(h) { return up(h).replace(/[^A-Z0-9]/g, ''); }
  function getAllRows() { return Array.from(document.querySelectorAll('.conf-grid-row')); }

  function modelFromCard(card) {
    const t = up(card?.textContent || '');
    if (t.includes('540')) return 540;
    if (t.includes('600')) return 600;
    if (t.includes('636')) return 636;
    return null;
  }

  function getSelectedModelNumberOrFallback() {
    const row0 = getAllRows()[0];
    const selected = row0?.querySelector('.conf-card.selected');
    const m = selected ? modelFromCard(selected) : null;
    if (m) return m;
    const first = row0?.querySelector('.conf-card');
    return first ? (modelFromCard(first) || 540) : 540;
  }

  function getDropdownToggleText() {
    return document.querySelector('.country-selector-dropdown .w-dropdown-toggle .text-block')
      ?.textContent?.trim() || '';
  }

  function getCountryFromDropdownText(text) {
    let t = (text || '').replace(/\u00a0/g, ' ').trim();
    t = t.replace(/\s*\d.*$/g, '').trim();
    t = t.replace(/\s*VAT.*$/i, '').trim();
    return up(t);
  }

  // -----------------------------
  // SHEET LOADER
  // -----------------------------
  const sheet = {
    loaded: false,
    headerRaw: [],
    headerUp: [],
    tableRows: [],
    idx: { code: -1, model: -1, trans: -1, engine: -1, brand: -1 },
    byCol: new Map() // colKey -> { colIndex, map(code->gross) }
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

  async function loadSheet() {
    if (!CSV_URL) throw new Error('Missing CSV url (window.WOMONDO_CFG.csvUrl)');
    const res = await fetch(CSV_URL + '&_ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);

    const csv = await res.text();
    const table = parseCSV(csv);
    if (!table.length) throw new Error('CSV empty');

    sheet.headerRaw = table[0];
    sheet.headerUp = sheet.headerRaw.map(h => up(h));
    sheet.tableRows = table.slice(1);

    const idxOf = (name) => sheet.headerUp.indexOf(up(name));
    sheet.idx.code   = idxOf('MO_CODE');
    sheet.idx.model  = idxOf('MODEL');
    sheet.idx.trans  = idxOf('TRANS');
    sheet.idx.engine = idxOf('ENGINE');
    sheet.idx.brand  = idxOf('BRAND');

    if (sheet.idx.code < 0) throw new Error('CSV must contain MO_CODE header');

    sheet.byCol.clear();

    const META = new Set(['MO_CODE','MODEL','BRAND','TRANS','ENGINE','PRICE','DESCRIPTION']);
    sheet.headerRaw.forEach((h, colIndex) => {
      const H = up(h);
      if (colIndex === sheet.idx.code) return;
      if (META.has(H)) return;

      const colKey = normHeader(h); // e.g. "DE", "SI"
      const map = new Map();

      for (const r of sheet.tableRows) {
        const code = up(r[sheet.idx.code]);
        const gross = parseNumberLoose(r[colIndex]);

        // ✅ allow 0 values
        if (code && Number.isFinite(gross) && gross >= 0) map.set(code, gross);
      }

      sheet.byCol.set(colKey, { colIndex, map });
    });

    sheet.loaded = true;
    log('Sheet loaded columns:', [...sheet.byCol.keys()]);
  }

  function pickColumnKeyForCountry(countryUpper) {
    const preferred = COUNTRY_TO_SHEET_COL[countryUpper] || countryUpper;
    const key1 = normHeader(preferred);
    if (sheet.byCol.has(key1)) return key1;

    const key2 = normHeader(countryUpper);
    if (sheet.byCol.has(key2)) return key2;

    const de = normHeader('DE');
    if (sheet.byCol.has(de)) return de;

    return sheet.byCol.keys().next().value || null;
  }

  // Step 1–2 price based on MODEL+TRANS+ENGINE
  function getConfigPrice(modelNum, trans, engine, colIndex) {
    const M = Number(modelNum);
    const T = up(trans);
    const E = up(engine);

    if (sheet.idx.model < 0 || sheet.idx.trans < 0 || sheet.idx.engine < 0) return NaN;

    for (const r of sheet.tableRows) {
      const m = parseInt((r[sheet.idx.model] || '').toString().replace(/[^\d]/g,''), 10);
      const t = up(r[sheet.idx.trans]);
      const e = up(r[sheet.idx.engine]);
      if (m === M && t === T && e === E) {
        const gross = parseNumberLoose(r[colIndex]);
        if (Number.isFinite(gross) && gross >= 0) return gross;
      }
    }
    return NaN;
  }

  // -----------------------------
  // CODE LOCKING (so switching country works)
  // -----------------------------
  function lockCodesOnce() {
    document.querySelectorAll('.conf-grid-row .conf-card .conf-price').forEach(el => {
      if (el.getAttribute('data-price-code')) return;
      const code = extractCode(el.textContent);
      if (code) el.setAttribute('data-price-code', code);
    });

    document.querySelectorAll('.conf-sub-card').forEach(sub => {
      if (sub.getAttribute('data-option-code')) return;

      const attr = extractCode(sub.getAttribute('data-option-price'));
      if (attr) { sub.setAttribute('data-option-code', attr); return; }

      const priceEl = sub.querySelector('.option-price, .sub-option-price');
      const code = extractCode(priceEl?.textContent || '');
      if (code) sub.setAttribute('data-option-code', code);
    });

    document.querySelectorAll('.extra-item').forEach(item => {
      if (item.getAttribute('data-extra-code')) return;

      const attr = extractCode(item.getAttribute('data-extra-price'));
      if (attr) { item.setAttribute('data-extra-code', attr); return; }

      const priceEl = item.querySelector('.extra-price');
      const code = extractCode(priceEl?.textContent || '');
      if (code) item.setAttribute('data-extra-code', code);
    });

    log('Code lock done ✅');
  }

  // -----------------------------
  // APPLY PRICES
  // -----------------------------
  function setModelBase(card, gross) {
    const priceEl = card?.querySelector('.conf-price');
    if (!priceEl) return;
    priceEl.setAttribute('data-gross-base', String(gross));
    priceEl.textContent = formatEuro(gross);
  }

  function setAddon(subCard, grossAddon) {
    if (!subCard) return;
    subCard.setAttribute('data-option-gross-base', String(grossAddon));
    const txt = '+' + formatEuro(grossAddon);
    subCard.querySelector('.option-price') && (subCard.querySelector('.option-price').textContent = txt);
    subCard.querySelector('.sub-option-price') && (subCard.querySelector('.sub-option-price').textContent = txt);
  }

  function applyStep1BasePrices(colIndex) {
    const row0 = getAllRows()[0];
    if (!row0) return;

    row0.querySelectorAll('.conf-card').forEach(card => {
      const m = modelFromCard(card);
      if (!m) return;
      const manual = getConfigPrice(m, 'MANUAL', '140HP', colIndex);
      if (Number.isFinite(manual)) setModelBase(card, manual);
    });
  }

  function applyStep2AddonsForModel(modelNum, colIndex) {
    const row1 = getAllRows()[1];
    if (!row1) return;

    const manual = getConfigPrice(modelNum, 'MANUAL', '140HP', colIndex);
    const auto140 = getConfigPrice(modelNum, 'AUTOMATIC', '140HP', colIndex);
    const auto180 = getConfigPrice(modelNum, 'AUTOMATIC', '180HP', colIndex);
    if (!Number.isFinite(manual) || !Number.isFinite(auto140) || !Number.isFinite(auto180)) return;

    const addon140 = auto140 - manual;
    const addon180 = auto180 - manual;

    row1.querySelectorAll('.conf-card').forEach(brandCard => {
      brandCard.querySelectorAll('.conf-sub-card').forEach(sub => {
        const t = up(sub.textContent || '');
        if (t.includes('180')) setAddon(sub, addon180);
        else if (t.includes('AUTOMATIC')) setAddon(sub, addon140);
      });
    });
  }

  function applyCodePricesForRows2Plus(codeMap) {
    const rows = getAllRows();
    if (!rows.length) return;

    rows.forEach((rowEl, idx) => {
      if (idx < 2) return;

      rowEl.querySelectorAll('.conf-card .conf-price').forEach(el => {
        const code = extractCode(el.getAttribute('data-price-code')) || extractCode(el.textContent);
        if (!code) return;
        const gross = codeMap.get(code);
        if (!Number.isFinite(gross)) return;
        el.setAttribute('data-gross-base', String(gross));
        el.textContent = formatEuro(gross);
      });

      rowEl.querySelectorAll('.conf-sub-card').forEach(sub => {
        const code =
          extractCode(sub.getAttribute('data-option-code')) ||
          extractCode(sub.getAttribute('data-option-price')) ||
          extractCode(sub.querySelector('.option-price, .sub-option-price')?.textContent || '');
        if (!code) return;

        const gross = codeMap.get(code);
        if (!Number.isFinite(gross)) return;

        sub.setAttribute('data-option-gross-base', String(gross));
        const txt = '+' + formatEuro(gross);
        sub.querySelector('.option-price') && (sub.querySelector('.option-price').textContent = txt);
        sub.querySelector('.sub-option-price') && (sub.querySelector('.sub-option-price').textContent = txt);
      });
    });

    // extras
    document.querySelectorAll('.extra-item').forEach(item => {
      const code = extractCode(item.getAttribute('data-extra-code')) || extractCode(item.getAttribute('data-extra-price'));
      if (!code) return;

      const gross = codeMap.get(code);
      if (!Number.isFinite(gross)) return;

      item.setAttribute('data-extra-gross-base', String(gross));
      item.setAttribute('data-extra-code', code);

      const priceEl = item.querySelector('.extra-price');
      if (priceEl) priceEl.textContent = formatEuro(gross);
    });
  }

  function syncSelectedPricesFromDOM() {
    function getCardById(cardId) {
      const m = cardId.match(/^row(\d+)-card(\d+)$/);
      if (!m) return null;
      const rowIndex = parseInt(m[1], 10);
      const cardIndex = parseInt(m[2], 10);
      const rowEl = getAllRows()[rowIndex];
      if (!rowEl) return null;
      const cards = rowEl.querySelectorAll('.conf-card');
      return cards[cardIndex] || null;
    }

    Object.keys(selectedItems).forEach(cardId => {
      const card = getCardById(cardId);
      if (!card) return;
      const gross = parseFloat(card.querySelector('.conf-price')?.getAttribute('data-gross-base') || '0');
      if (Number.isFinite(gross)) selectedItems[cardId].priceGross = gross;
    });

    Object.keys(selectedSubOptions).forEach(cardId => {
      const card = getCardById(cardId);
      if (!card) return;
      const sub = card.querySelector('.conf-sub-card.selected');
      if (!sub) return;
      const gross = parseFloat(sub.getAttribute('data-option-gross-base') || '0');
      if (Number.isFinite(gross)) selectedSubOptions[cardId].priceGross = gross;
    });

    if (window.selectedExtras && Object.keys(window.selectedExtras).length) {
      Object.keys(window.selectedExtras).forEach(extraId => {
        const el = document.querySelector(`.extra-item[data-extra-id="${CSS.escape(extraId)}"]`);
        if (!el) return;
        const gross = parseFloat(el.getAttribute('data-extra-gross-base') || '0');
        if (Number.isFinite(gross)) window.selectedExtras[extraId].priceGross = gross;
      });
    }
  }

  function applyPricesForCountry(countryUpper, forcedCol = null) {
    if (!sheet.loaded) return;

    const colKey = forcedCol ? normHeader(forcedCol) : pickColumnKeyForCountry(countryUpper);
    if (!colKey) return;

    const colObj = sheet.byCol.get(colKey);
    if (!colObj) return;

    currentCountry = countryUpper;
    currentCountryColKey = colKey;

    applyStep1BasePrices(colObj.colIndex);
    const m = getSelectedModelNumberOrFallback();
    applyStep2AddonsForModel(m, colObj.colIndex);
    applyCodePricesForRows2Plus(colObj.map);

    syncSelectedPricesFromDOM();
    syncAutoTransportFee();

    updateSelectedEquipment();
    calculateTotal();

    window.WOMONDO_FINAL = { country: currentCountry, col: currentCountryColKey };
    log('Applied', countryUpper, 'column', colKey);
  }

  // -----------------------------
  // COUNTRY DROPDOWN
  // -----------------------------
  function getForcedColForLink(linkEl) {
    const forced = (linkEl?.getAttribute('data-sheet-col') || '').trim().toUpperCase();
    return forced || '';
  }

  function findLinkMatchingToggleText() {
    const toggleText = getDropdownToggleText();
    if (!toggleText) return null;
    const links = Array.from(document.querySelectorAll('.country-selector-dropdown .w-dropdown-list .w-dropdown-link'));
    return links.find(a => (a.textContent || '').trim() === toggleText.trim()) || null;
  }

  function readInitialCountryAndCol() {
    const match = findLinkMatchingToggleText();
    const forcedCol = getForcedColForLink(match);
    const currentText = match?.textContent?.trim() || getDropdownToggleText();
    const detectedCountry = currentText ? getCountryFromDropdownText(currentText) : 'GERMANY';
    return { detectedCountry, forcedCol };
  }

  function handleCountryClick(e) {
    const link = e.target.closest('.w-dropdown-link');
    if (!link) return;

    const text = link.textContent || '';
    const countryUpper = getCountryFromDropdownText(text);
    const forcedCol = getForcedColForLink(link);

    const dropdownToggle = document.querySelector('.country-selector-dropdown .w-dropdown-toggle .text-block');
    if (dropdownToggle) dropdownToggle.textContent = text;

    applyPricesForCountry(countryUpper, forcedCol || null);
  }

// -----------------------------
// AUTO TRANSPORT FEE (PRIMARY ONLY)
// -----------------------------
function getCodeMapForCurrentCountry() {
  const colObj = sheet.byCol.get(currentCountryColKey);
  return colObj?.map || null;
}

function getAutoFeeGross(primaryCode) {
  const map = getCodeMapForCurrentCountry();
  if (!map) return 0;

  const g = map.get(up(primaryCode));
  return Number.isFinite(g) ? g : 0;
}

function syncAutoTransportFee() {
  const shouldAdd = step1SelectedHasLengthCode();

  if (!shouldAdd) {
    delete autoFees[TRANSPORT_PRIMARY];
    return;
  }

  const gross = getAutoFeeGross(TRANSPORT_PRIMARY);

  autoFees[TRANSPORT_PRIMARY] = {
    name: TRANSPORT_LABEL,
    code: TRANSPORT_PRIMARY,
    priceGross: gross || 0
  };
}

  // -----------------------------
  // EXTRAS
  // -----------------------------
  function cryptoRandomId() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0].toString(36); }
    catch { return Math.random().toString(36).slice(2); }
  }

  function handleExtraSelection(item) {
    const extraId = item.getAttribute('data-extra-id') || cryptoRandomId();
    if (!item.getAttribute('data-extra-id')) item.setAttribute('data-extra-id', extraId);

    const extraName = (item.querySelector('.extra-name')?.textContent || 'Extra').trim();
    const gross = parseFloat(item.getAttribute('data-extra-gross-base') || '0');

    if (item.classList.contains('selected')) {
      item.classList.remove('selected');
      delete window.selectedExtras[extraId];
    } else {
      item.classList.add('selected');
      window.selectedExtras[extraId] = { name: extraName, priceGross: gross || 0, type: 'extra' };
    }

    updateSelectedEquipment();
    calculateTotal();
  }

  function initializeExtras() {
    document.querySelectorAll('.extra-item').forEach(item => {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        handleExtraSelection(this);
      });
    });
  }

  // -----------------------------
  // SELECTION LOGIC
  // -----------------------------
  function getCardIndicesFromEl(el) {
    const card = el.closest('.conf-card');
    if (!card) return null;

    const row = card.closest('.conf-grid-row');
    const allRows = getAllRows();
    const rowIndex = row ? allRows.indexOf(row) : -1;

    const cardsInRow = row ? row.querySelectorAll('.conf-card') : [];
    const cardIndex = card ? Array.from(cardsInRow).indexOf(card) : -1;

    return { card, rowIndex, cardIndex, cardId: `row${rowIndex}-card${cardIndex}` };
  }

  function ensureCardSelected(card, rowIndex, cardIndex) {
    if (!card || rowIndex < 0 || cardIndex < 0) return;
    if (!card.classList.contains('selected')) handleCardClick(card, rowIndex, cardIndex);
  }

  function handleColorCardClick(colorCard, card, cardId) {
    card.querySelectorAll('.conf-color-card').forEach(cc => {
      if (cc !== colorCard) {
        cc.classList.remove('selected');
        cc.querySelector('.color-swatch')?.classList.remove('selected');
      }
    });

    const sw = colorCard.querySelector('.color-swatch');
    const isOn = colorCard.classList.contains('selected') || (sw && sw.classList.contains('selected'));

    if (isOn) {
      colorCard.classList.remove('selected');
      sw?.classList.remove('selected');
      delete selectedSubOptions[cardId];
    } else {
      colorCard.classList.add('selected');
      sw?.classList.add('selected');
      const name = (colorCard.querySelector('.color-name')?.textContent || '').trim();
      selectedSubOptions[cardId] = { title: name, priceGross: 0 };
    }

    updateSelectedEquipment();
    calculateTotal();
  }

  function handleSubCardClick(subCard, card, cardId) {
    card.querySelectorAll('.conf-sub-card').forEach(sc => { if (sc !== subCard) sc.classList.remove('selected'); });

    if (subCard.classList.contains('selected')) {
      subCard.classList.remove('selected');
      delete selectedSubOptions[cardId];
    } else {
      subCard.classList.add('selected');
      const optionTitle = (subCard.querySelector('.option-title')?.textContent || '').trim();
      const gross = parseFloat(subCard.getAttribute('data-option-gross-base') || '0');
      selectedSubOptions[cardId] = { title: optionTitle, priceGross: gross || 0 };
    }

    updateSelectedEquipment();
    calculateTotal();
  }

  function handleCardClick(card, rowIndex, cardIndex) {
    const row = card.parentElement;
    const cardsInRow = row.querySelectorAll('.conf-card');
    const rule = selectionRules[rowIndex];
    const cardId = `row${rowIndex}-card${cardIndex}`;

    function getCardGross(c) {
      const priceEl = c.querySelector('.conf-price');
      if (!priceEl) return 0;
      return parseFloat(priceEl.getAttribute('data-gross-base') || '0');
    }

    function getCardTitle(c) {
      let title = c.querySelector('.card-h1-header')?.textContent || c.querySelector('h1')?.textContent || '';
      if ((title || '').toLowerCase().includes('off grid pack')) title = 'OFF GRID PACK';
      return (title || '').trim();
    }

    if (rule === 'multiple') {
      if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        delete selectedItems[cardId];
        delete selectedSubOptions[cardId];
        card.querySelectorAll('.conf-sub-card').forEach(sc => sc.classList.remove('selected'));
        card.querySelectorAll('.conf-color-card, .color-swatch').forEach(cc => cc.classList.remove('selected'));
      } else {
        card.classList.add('selected');
        selectedItems[cardId] = { title: getCardTitle(card), priceGross: getCardGross(card), row: rowIndex };

        if (rowIndex === 4) {
          const firstColor = card.querySelector('.conf-color-card');
          if (firstColor) handleColorCardClick(firstColor, card, cardId);
        }
      }
    } else {
      if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        delete selectedItems[cardId];
        delete selectedSubOptions[cardId];
        card.querySelectorAll('.conf-sub-card').forEach(sc => sc.classList.remove('selected'));
        card.querySelectorAll('.conf-color-card, .color-swatch').forEach(cc => cc.classList.remove('selected'));

        if (rowIndex === 0) {
          selectedModel = null;
          baseTotalGross = 0;
          syncAutoTransportFee();
        }
      } else {
        cardsInRow.forEach((c, idx) => {
          c.classList.remove('selected');
          delete selectedItems[`row${rowIndex}-card${idx}`];
          delete selectedSubOptions[`row${rowIndex}-card${idx}`];
          c.querySelectorAll('.conf-sub-card').forEach(sc => sc.classList.remove('selected'));
          c.querySelectorAll('.conf-color-card, .color-swatch').forEach(cc => cc.classList.remove('selected'));
        });

        card.classList.add('selected');
        selectedItems[cardId] = { title: getCardTitle(card), priceGross: getCardGross(card), row: rowIndex };

        if (rowIndex === 0) {
          selectedModel = `Womondo ${selectedItems[cardId].title}`;
          baseTotalGross = selectedItems[cardId].priceGross;
          syncAutoTransportFee();

          const colObj = sheet.byCol.get(currentCountryColKey);
          if (colObj) {
            const m = modelFromCard(card) || getSelectedModelNumberOrFallback();
            applyStep2AddonsForModel(m, colObj.colIndex);
            syncSelectedPricesFromDOM();
          }
        }

        if (rowIndex === 4) {
          const firstColor = card.querySelector('.conf-color-card');
          if (firstColor) handleColorCardClick(firstColor, card, cardId);
        }
      }
    }

    updateSelectedEquipment();
    calculateTotal();
  }

  // -----------------------------
  // SIDEBAR + TOTAL
  // -----------------------------
  function updateSelectedEquipment() {
    const equipmentDiv = document.querySelector('.selected-equipment');
    if (!equipmentDiv) return;

    equipmentDiv.innerHTML = '';

    if (selectedModel) {
      const modelDiv = document.createElement('div');
      modelDiv.className = 'selected-model';
      modelDiv.textContent = selectedModel;
      equipmentDiv.appendChild(modelDiv);
    }

    const equipmentList = document.createElement('div');
    equipmentList.className = 'equipment-list';
    equipmentDiv.appendChild(equipmentList);

    Object.entries(selectedItems)
      .filter(([_, item]) => item.row !== 0)
      .sort((a, b) => a[1].row - b[1].row)
      .forEach(([key, item]) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'selected-item';

        let gross = item.priceGross || 0;
        if (selectedSubOptions[key]?.title) gross += selectedSubOptions[key].priceGross || 0;

        const title = selectedSubOptions[key]?.title
          ? `${item.title}<div class="selected-sub-option">+ ${selectedSubOptions[key].title}</div>`
          : item.title;

        itemDiv.innerHTML = `<span>${title}</span><span>${formatEuro(gross)}</span>`;
        equipmentList.appendChild(itemDiv);
      });

    // Fees
    if (autoFees && Object.keys(autoFees).length > 0) {
      const fees = Object.values(autoFees);
      if (fees.length) {
        const sep = document.createElement('div');
        sep.style.cssText = 'margin:16px 0;padding-top:16px;border-top:1px solid #e5e7eb;';
        equipmentList.appendChild(sep);

        const h = document.createElement('h4');
        h.style.cssText = 'margin-bottom:8px;font-size:14px;font-weight:600;';
        h.textContent = 'Fees:';
        equipmentList.appendChild(h);

        fees.forEach(fee => {
          const d = document.createElement('div');
          d.className = 'selected-item';
          d.style.cssText = 'padding:8px 16px;background:#f3f4f6;border-radius:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;';
          d.innerHTML = `<span>${fee.name}</span><span>${formatEuro(fee.priceGross || 0)}</span>`;
          equipmentList.appendChild(d);
        });
      }
    }

    // Extras
    if (window.selectedExtras && Object.keys(window.selectedExtras).length > 0) {
      const sep = document.createElement('div');
      sep.style.cssText = 'margin:16px 0;padding-top:16px;border-top:1px solid #e5e7eb;';
      equipmentList.appendChild(sep);

      const h = document.createElement('h4');
      h.style.cssText = 'margin-bottom:8px;font-size:14px;font-weight:600;';
      h.textContent = 'Special Extras:';
      equipmentList.appendChild(h);

      Object.values(window.selectedExtras).forEach(extra => {
        const d = document.createElement('div');
        d.className = 'selected-item';
        d.style.cssText = 'padding:8px 16px;background:#f3f4f6;border-radius:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;';
        d.innerHTML = `<span>${extra.name}</span><span>${formatEuro(extra.priceGross || 0)}</span>`;
        equipmentList.appendChild(d);
      });
    }
  }

  function calculateTotal() {
    let grossTotal = 0;
    if (selectedModel) grossTotal = baseTotalGross;

    Object.entries(selectedItems).forEach(([key, item]) => {
      if (item.row !== 0) {
        grossTotal += item.priceGross || 0;
        if (selectedSubOptions[key]?.title) grossTotal += selectedSubOptions[key].priceGross || 0;
      }
    });

    if (window.selectedExtras) Object.values(window.selectedExtras).forEach(ex => grossTotal += ex.priceGross || 0);
    if (autoFees) Object.values(autoFees).forEach(fee => grossTotal += fee.priceGross || 0);

    const totalEl = document.querySelector('.total-price .conf-price');
    if (totalEl) totalEl.textContent = formatEuro(grossTotal);
    return grossTotal;
  }

  // -----------------------------
  // PDF (still works if you later want to call it)
  // NOTE: we are NOT binding PDF to the download button here,
  // because Webflow uses that button to open the form modal.
  // -----------------------------
  async function generatePDF() {
    if (!window.jspdf?.jsPDF) {
      alert('jsPDF not loaded');
      return;
    }
    if (!selectedModel) {
      alert('Please select a model first!');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const PX_TO_MM = 1 / 3.78;
    const PAD_60_MM = 60 * PX_TO_MM;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    function ensureSpace(mmNeeded, y) {
      const bottom = pageHeight - (60 * PX_TO_MM);
      if (y + mmNeeded > bottom) { doc.addPage(); return 20; }
      return y;
    }
    function textWrapped(str, x, y, maxWidth) {
      const lines = doc.splitTextToSize(str, maxWidth);
      doc.text(lines, x, y);
      return y + (lines.length * 5);
    }

    let y = PAD_60_MM;

    doc.setTextColor(0,0,0);
    doc.setFont("helvetica","bold");
    doc.setFontSize(18);
    doc.text("CAMPER VAN CONFIGURATION", pageWidth / 2, y, { align: "center" });
    y += PAD_60_MM;

    doc.setFont("helvetica","normal");
    doc.setFontSize(11);

    const countryLabel = (document.querySelector('.country-selector-dropdown .w-dropdown-toggle .text-block')?.textContent || '').trim();
    y = ensureSpace(20, y);
    doc.text(`Date: ${new Date().toLocaleDateString('de-DE')}`, 20, y); y += 6;
    if (countryLabel) { doc.text(`Country: ${countryLabel}`, 20, y); y += 6; }
    doc.text(`Price column: ${currentCountryColKey}`, 20, y); y += 10;

    doc.setFont("helvetica","bold");
    doc.text(`Model: ${selectedModel}`, 20, y); y += 6;

    doc.setFont("helvetica","normal");
    doc.text(`Base Price: ${formatEuro(baseTotalGross)}`, 20, y); y += 10;

    doc.setFont("helvetica","bold");
    doc.text("Selected Equipment:", 20, y); y += 6;
    doc.setFont("helvetica","normal");

    const itemsSorted = Object.entries(selectedItems)
      .filter(([_, item]) => item.row !== 0)
      .sort((a, b) => a[1].row - b[1].row);

    itemsSorted.forEach(([key, item]) => {
      let gross = item.priceGross || 0;
      let line = item.title || 'Item';
      if (selectedSubOptions[key]?.title) {
        line += ` - ${selectedSubOptions[key].title}`;
        gross += selectedSubOptions[key].priceGross || 0;
      }
      y = ensureSpace(10, y);
      y = textWrapped(`- ${line}: ${formatEuro(gross)}`, 25, y, pageWidth - 40);
    });

    if (autoFees && Object.keys(autoFees).length) {
      y += 3; y = ensureSpace(14, y);
      doc.setFont("helvetica","bold"); doc.text("Fees:", 20, y); y += 6;
      doc.setFont("helvetica","normal");
      Object.values(autoFees).forEach(fee => {
        y = ensureSpace(10, y);
        y = textWrapped(`- ${fee.name}: ${formatEuro(fee.priceGross || 0)}`, 25, y, pageWidth - 40);
      });
    }

    if (window.selectedExtras && Object.keys(window.selectedExtras).length) {
      y += 3; y = ensureSpace(14, y);
      doc.setFont("helvetica","bold"); doc.text("Special Extras:", 20, y); y += 6;
      doc.setFont("helvetica","normal");
      Object.values(window.selectedExtras).forEach(extra => {
        y = ensureSpace(10, y);
        y = textWrapped(`- ${extra.name}: ${formatEuro(extra.priceGross || 0)}`, 25, y, pageWidth - 40);
      });
    }

    const totalGross = calculateTotal();
    y += 6; y = ensureSpace(20, y);
    doc.setFont("helvetica","bold");
    doc.text(`Total (incl. tax): ${formatEuro(totalGross)}`, 20, y);

    doc.save(`Womondo-${selectedModel.replace(/\s+/g, '-')}-Configuration.pdf`);
  }

  // -----------------------------
  // JSON payload + remapping
  // -----------------------------
  function detectBrandKeyFromUI() {
    const row1 = getAllRows()[1];
    const txt = (row1?.querySelector('.conf-card.selected')?.textContent || '').toUpperCase();
    if (txt.includes('CITROEN')) return 'CITROEN';
    if (txt.includes('OPEL')) return 'OPEL';
    return 'FIAT';
  }

  function detectTransEngineFromUI() {
    const row1 = getAllRows()[1];
    const sub = row1?.querySelector('.conf-card.selected .conf-sub-card.selected');
    const t = (sub?.textContent || '').toUpperCase();
    let trans = 'MANUAL', engine = '140HP';
    if (t.includes('AUTOMATIC')) {
      trans = 'AUTOMATIC';
      engine = t.includes('180') ? '180HP' : '140HP';
    }
    return { trans, engine };
  }

  function detectLengthKeyFromModel(modelNum) { return Number(modelNum) === 540 ? 'L2' : 'L3L4'; }

  function getBaseMoCode(modelNum, brandKey, trans, engine) {
    if (!sheet.loaded) return null;
    const M = Number(modelNum);
    const T = up(trans);
    const E = up(engine);
    const B = up(brandKey);

    for (const r of sheet.tableRows) {
      const m = parseInt((r[sheet.idx.model] || '').toString().replace(/[^\d]/g,''), 10);
      const t = up(r[sheet.idx.trans]);
      const e = up(r[sheet.idx.engine]);
      if (m !== M || t !== T || e !== E) continue;

      if (sheet.idx.brand >= 0) {
        const b = up(r[sheet.idx.brand]);
        if (b && !b.includes(B)) continue;
      }

      const code = (r[sheet.idx.code] || '').toString().trim().toUpperCase();
      return code || null;
    }
    return null;
  }

  const CHASSIS_REMAP = {
    FIAT:    { DRIVE: 'CH0775',  TECH: 'CH0774',  STYLE_L3L4: 'CH0776',  STYLE_L2: 'CH0777' },
    CITROEN: { DRIVE: 'CH0778',  TECH: 'CH0779',  STYLE_L3L4: 'CH0780',  STYLE_L2: 'CH0781' },
    OPEL:    { DRIVE: 'CH0782',  TECH: 'CH0783', STYLE_L3L4: 'CH0784',  STYLE_L2: 'CH0785' }
  };

  function chassisTypeFromCode(code) {
    const c = (code || '').toUpperCase();
    if (['CH0775','CH0778','CH0782'].includes(c)) return 'DRIVE';
    if (['CH0774','CH0779','CH0783'].includes(c)) return 'TECH';
    if (['CH0776','CH0777','CH0780','CH0781','CH0784','CH0785'].includes(c)) return 'STYLE';
    return null;
  }

  function remapChassisCode(uiCode, brandKey, modelNum) {
    const type = chassisTypeFromCode(uiCode);
    if (!type) return uiCode;
    const lenKey = detectLengthKeyFromModel(modelNum);
    const map = CHASSIS_REMAP[brandKey] || CHASSIS_REMAP.FIAT;
    if (type === 'DRIVE') return map.DRIVE;
    if (type === 'TECH') return map.TECH;
    return (lenKey === 'L2') ? map.STYLE_L2 : map.STYLE_L3L4;
  }

  const COLOR_REMAP = {
    FIAT: {
      BASE_WHITE: 'CH0320', STANDARD_EXPEDITION_GREY: 'CH0327', STANDARD_LANZAROTE_GREY: 'CH0328',
      METALIC_ARTENSE_GREY: 'CH0323', METALIC_FERRO_GREY: 'CH0329', METALIC_GRAPHITO_GREY: 'CH0321'
    },
    CITROEN: {
      BASE_WHITE: 'CH0301', STANDARD_EXPEDITION_GREY: 'CH0302', STANDARD_LANZAROTE_GREY: 'CH0303',
      METALIC_ARTENSE_GREY: 'CH0304', METALIC_FERRO_GREY: 'CH0305', METALIC_GRAPHITO_GREY: 'CH0306'
    },
    OPEL: {
      BASE_WHITE: 'CH0350', STANDARD_EXPEDITION_GREY: 'CH0351', STANDARD_LANZAROTE_GREY: 'CH0352',
      METALIC_ARTENSE_GREY: 'CH0353', METALIC_FERRO_GREY: 'CH0354', METALIC_GRAPHITO_GREY: 'CH0355'
    }
  };

  function colorKeyFromName(name) {
    const s = (name || '').toLowerCase();
    if (s.includes('white')) return 'BASE_WHITE';
    if (s.includes('expedition')) return 'STANDARD_EXPEDITION_GREY';
    if (s.includes('lanzarote')) return 'STANDARD_LANZAROTE_GREY';
    if (s.includes('artense')) return 'METALIC_ARTENSE_GREY';
    if (s.includes('ferro')) return 'METALIC_FERRO_GREY';
    if (s.includes('graphito')) return 'METALIC_GRAPHITO_GREY';
    return null;
  }

  function getSelectedColorNameFromUI() {
    const row4 = getAllRows()[4];
    const card = row4?.querySelector('.conf-card.selected');
    const selectedColor = card?.querySelector('.conf-color-card.selected, .color-swatch.selected')?.closest('.conf-color-card');
    return (selectedColor?.querySelector('.color-name')?.textContent || '').trim();
  }

  function remapColorCodeByBrand(brandKey, colorName) {
    const key = colorKeyFromName(colorName);
    if (!key) return null;
    const map = COLOR_REMAP[brandKey] || COLOR_REMAP.FIAT;
    return map[key] || null;
  }

  function collectSelectedItemsCodes() {
    const items = [];
    const rows = getAllRows();

    rows.forEach((rowEl, rowIndex) => {
      if (rowIndex < 2) return;

      rowEl.querySelectorAll('.conf-card.selected').forEach(card => {
        const title = (card.querySelector('.card-h1-header')?.textContent || card.querySelector('h1')?.textContent || '').trim();

        const priceEl = card.querySelector('.conf-price');
        const code = extractCode(priceEl?.getAttribute('data-price-code')) || extractCode(priceEl?.textContent || '');
        if (code) items.push({ step: rowIndex + 1, title, code, qty: 1 });

        const sub = card.querySelector('.conf-sub-card.selected');
        if (sub) {
          const subTitle = (sub.querySelector('.option-title')?.textContent || '').trim();
          const subCode =
            extractCode(sub.getAttribute('data-option-code')) ||
            extractCode(sub.getAttribute('data-option-price')) ||
            extractCode(sub.querySelector('.option-price, .sub-option-price')?.textContent || '');
          if (subCode) items.push({ step: rowIndex + 1, title: subTitle || 'Sub option', code: subCode, qty: 1 });
        }
      });
    });

    document.querySelectorAll('.extra-item.selected').forEach(item => {
      const name = (item.querySelector('.extra-name')?.textContent || 'Extra').trim();
      const code =
        extractCode(item.getAttribute('data-extra-code')) ||
        extractCode(item.getAttribute('data-extra-price')) ||
        extractCode(item.querySelector('.extra-price')?.textContent || '');
      if (code) items.push({ step: 'EXTRA', title: name, code, qty: 1 });
    });

    // Auto transport fee: send only the primary code
if (autoFees && autoFees[TRANSPORT_PRIMARY]) {
  items.push({ step: 'FEE', title: TRANSPORT_LABEL, code: TRANSPORT_PRIMARY, qty: 1 });
}

    return items;
  }

function buildPayload() {
  // ✅ We keep the function name buildPayload()
  // so you DON'T need to change any other code.
  // It will now return ONLY MO codes + a human note.

  const modelNum = getSelectedModelNumberOrFallback();
  const brandKey = detectBrandKeyFromUI();
  const { trans, engine } = detectTransEngineFromUI();

  const baseMoCode = getBaseMoCode(modelNum, brandKey, trans, engine);

  // machine list (codes)
  const items = collectSelectedItemsCodes();

  // remap chassis in Step 3
  items.forEach(it => { if (it.step === 3) it.code = remapChassisCode(it.code, brandKey, modelNum); });

  // add color as code (Step 5)
  const colorName = getSelectedColorNameFromUI();
  if (colorName) {
    const colorCode = remapColorCodeByBrand(brandKey, colorName);
    if (colorCode) items.push({ step: 5, title: `Colour: ${colorName}`, code: colorCode, qty: 1 });
  }

  // ✅ MO_CODES array (deduped)
  const rawCodes = [
    baseMoCode,
    ...items.map(i => i.code)
  ]
    .filter(Boolean)
    .map(c => String(c).trim().toUpperCase());

  const seen = new Set();
  const mo_codes = rawCodes.filter(c => (seen.has(c) ? false : (seen.add(c), true)));

  // ✅ NOTE text (human-readable names + prices)
  const note = buildSummaryText();

  const total_gross = calculateTotal();

  return {
    mo_codes,      // <-- ONLY codes go here
    note,          // <-- “comment” for humans (names + prices)
    total_gross    // <-- numeric total (optional, but useful)
  };
}

  // -----------------------------
  // WEBHOOK SEND (no local download)
  // -----------------------------
  async function postWebhook(payload) {
    if (!WEBHOOK_URL) {
      console.warn('[WOMONDO] Missing webhookUrl in window.WOMONDO_CFG.webhookUrl');
      return { ok: false, error: 'Missing webhookUrl' };
    }

    // Prefer sendBeacon if available (best with form submits / navigation)
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon(WEBHOOK_URL, blob)) {
        log('Webhook sent via sendBeacon ✅');
        return { ok: true, via: 'beacon' };
      }
    } catch (e) {
      // continue to fetch
    }

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
      const text = await res.text().catch(() => '');
      log('Webhook fetch status:', res.status, text?.slice?.(0, 200) || '');
      return { ok: res.ok, status: res.status, body: text };
    } catch (err) {
      console.warn('[WOMONDO] Webhook error:', err);
      return { ok: false, error: String(err) };
    }
  }

  function readFormFields(formEl) {
    const data = {};
    if (!formEl) return data;

    // capture all inputs/selects/textareas
    const fields = formEl.querySelectorAll('input, select, textarea');
    fields.forEach(el => {
      const key = el.name || el.id || el.getAttribute('data-name') || '';
      if (!key) return;

      if (el.type === 'checkbox') data[key] = !!el.checked;
      else data[key] = (el.value ?? '').toString().trim();
    });

    return data;
  }
// =============================
// ✅ WRITE SUMMARY + PAYLOAD_JSON TO FORM (same moment)
// =============================

// IMPORTANT: this must match the *Webflow field NAME* of your textarea
// From your Pipedream dump it looks like it is exactly: "textarea field"
const SUMMARY_TEXTAREA_NAME = 'textarea-field';
  
function formatDateDE(d = new Date()) {
  return d.toLocaleDateString('de-DE');
}

function getCountryLabelFromUI() {
  return (document.querySelector('.country-selector-dropdown .w-dropdown-toggle .text-block')?.textContent || '').trim();
}

function buildSummaryText() {
  const lines = [];
  lines.push('=== WOMONDO CONFIGURATION ===');
  lines.push(`Date: ${formatDateDE()}`);

  const countryLabel = getCountryLabelFromUI();
  if (countryLabel) lines.push(`Country: ${countryLabel}`);

  lines.push('─────────────────────────────');
  lines.push(`MODEL: ${selectedModel || `Womondo ${getSelectedModelNumberOrFallback()}`}`);
  lines.push('SELECTED EQUIPMENT:');
  lines.push('─────────────────────────────');

  // Selected items (excluding row 0 model)
  Object.entries(selectedItems)
    .filter(([_, item]) => item.row !== 0)
    .sort((a, b) => a[1].row - b[1].row)
    .forEach(([key, item]) => {
      let gross = item.priceGross || 0;
      let title = item.title || 'Item';

      if (selectedSubOptions[key]?.title) {
        title += ` + ${selectedSubOptions[key].title}`;
        gross += selectedSubOptions[key].priceGross || 0;
      }

      lines.push(`• ${title}: ${formatEuro(gross)}`);
    });

  // Fees
  if (autoFees && Object.keys(autoFees).length) {
    Object.values(autoFees).forEach(fee => {
      lines.push(`• ${fee.name}: ${formatEuro(fee.priceGross || 0)}`);
    });
  }

  // Extras
  if (window.selectedExtras && Object.keys(window.selectedExtras).length) {
    lines.push('SPECIAL EXTRAS:');
    lines.push('─────────────────────────────');
    Object.values(window.selectedExtras).forEach(ex => {
      lines.push(`• ${ex.name}: ${formatEuro(ex.priceGross || 0)}`);
    });
  }

  lines.push('─────────────────────────────');
  const total = calculateTotal();
  lines.push(`TOTAL (incl. VAT): ${formatEuro(total)}`);
  lines.push('=============================');

  return lines.join('\n');
}

function getFieldByNameOrId(form, name) {
  return form.querySelector(`[name="${CSS.escape(name)}"]`) || form.querySelector(`#${CSS.escape(name)}`);
}

function setFieldValue(form, name, value) {
  let el = getFieldByNameOrId(form, name);

  // ✅ auto-create hidden inputs if missing
  if (!el) {
    el = document.createElement('input');
    el.type = 'hidden';
    el.name = name;
    el.id = name;
    form.appendChild(el);
  }

  el.required = false;
  el.removeAttribute('required');
  el.value = value == null ? '' : String(value);
}

// This writes BOTH:
// 1) textarea summary
// 2) hidden field payload_json
// in the SAME function call
function writeSummaryAndPayloadToForm(form) {
  try {
    syncAutoTransportFee();
    updateSelectedEquipment();
    const total = calculateTotal();

    const payload = buildPayload();
    const summary = buildSummaryText();

    // ✅ write into textarea (must match real field NAME)
    const summaryTextarea = getFieldByNameOrId(form, SUMMARY_TEXTAREA_NAME);
    if (summaryTextarea && summaryTextarea.tagName.toLowerCase() === 'textarea') {
      summaryTextarea.value = summary;
    } else {
      const anyTextarea = form.querySelector('textarea');
      if (anyTextarea) anyTextarea.value = summary;
    }

    // ✅ write hidden fields (these will be submitted)
    setFieldValue(form, 'payload_json', JSON.stringify(payload));
    setFieldValue(form, 'country_col', currentCountryColKey || '');
    setFieldValue(form, 'total_gross', payload?.total_gross ?? total ?? '');

    log('Summary + payload_json written ✅');
  } catch (e) {
    console.warn('[WOMONDO] writeSummaryAndPayloadToForm failed', e);
  }
}
function normalizePayload(raw, form) {
  if (raw && Array.isArray(raw.mo_codes)) {
    if (!raw.note) raw.note = (form?.querySelector(`[name="${CSS.escape(SUMMARY_TEXTAREA_NAME)}"]`)?.value || '').trim();
    if (raw.total_gross == null) raw.total_gross = null;
    return raw;
  }

  const baseCode = raw?.base?.moCode || raw?.base?.mo_code || raw?.base?.MO_CODE || null;

  const itemCodes = Array.isArray(raw?.items)
    ? raw.items.map(x => x?.code).filter(Boolean)
    : [];

  const rawCodes = [baseCode, ...itemCodes]
    .filter(Boolean)
    .map(c => String(c).trim().toUpperCase());

  const seen = new Set();
  const mo_codes = rawCodes.filter(c => (seen.has(c) ? false : (seen.add(c), true)));

const note = (form?.querySelector(`[name="${CSS.escape(SUMMARY_TEXTAREA_NAME)}"]`)?.value || '').trim();
  
  const total_gross =
    raw?.totals?.totalGross ??
    raw?.totals?.total_gross ??
    raw?.totals?.grossTotal ??
    null;

  return { mo_codes, note, total_gross };
}

// Bind early events so Webflow captures the values
function bindFormJsonOnlyWebhookAndFields() {
  const wrapper = document.querySelector('.conf-email-form');
  if (!wrapper) { console.warn('[WOMONDO] No .conf-email-form found'); return; }

  const form = wrapper.tagName?.toLowerCase() === 'form' ? wrapper : wrapper.querySelector('form');
  if (!form) { console.warn('[WOMONDO] No <form> inside .conf-email-form'); return; }

  if (form.getAttribute('data-womondo-bound') === '1') return;
  form.setAttribute('data-womondo-bound', '1');

  // ensure hidden fields exist INSIDE this form
  function ensureHidden(name) {
    let el = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = name;
      el.id = name;
      form.appendChild(el);
    }
    el.required = false;
    el.removeAttribute('required');
    return el;
  }

  const payloadField = ensureHidden('payload_json');
  ensureHidden('payload_full');
  ensureHidden('country_col');
  ensureHidden('total_gross');

  let _sent = false;

  function fire() {
    try {
      writeSummaryAndPayloadToForm(form);

      if (!_sent) {
        _sent = true;

        const raw = JSON.parse(payloadField.value || '{}');
        setFieldValue(form, 'payload_full', JSON.stringify(raw));

        const payload = normalizePayload(raw, form);

        // ✅ overwrite payload_json so Webflow submit gets normalized shape
        payloadField.value = JSON.stringify(payload);

        setFieldValue(form, 'total_gross', payload?.total_gross ?? '');
        setFieldValue(form, 'country_col', currentCountryColKey || '');

        postWebhook(payload).catch(err => console.warn('[WOMONDO] webhook send failed', err));

        setTimeout(() => { _sent = false; }, 2500);
      }

      console.log('[WOMONDO] fire() ok, payload_json length:', (payloadField.value || '').length);
    } catch (e) {
      console.warn('[WOMONDO] fire() failed', e);
    }
  }

  function isSubmitishTarget(t) {
    return !!t.closest('.conf-email-form [type="submit"], .conf-email-form .w-button');
  }

  document.addEventListener('pointerdown', (e) => {
    if (isSubmitishTarget(e.target)) fire();
  }, true);

  document.addEventListener('click', (e) => {
    if (isSubmitishTarget(e.target)) fire();
  }, true);

  form.addEventListener('submit', fire, true);

  console.log('[WOMONDO] bindFormJsonOnlyWebhookAndFields ✅');
}
  // -----------------------------
  // INIT
  // -----------------------------
  async function initialize() {
    // normalize a label (optional)
    document.querySelectorAll('.card-h1-header, h1').forEach(header => {
      if ((header.textContent || '').toLowerCase().includes('off grid pack')) header.textContent = 'OFF GRID PACK';
    });

    lockCodesOnce();
    await loadSheet();

    const { detectedCountry, forcedCol } = readInitialCountryAndCol();
    applyPricesForCountry(detectedCountry, forcedCol || null);

    const dropdownList = document.querySelector('.country-selector-dropdown .w-dropdown-list');
    if (dropdownList) dropdownList.addEventListener('click', handleCountryClick);

    // bind card clicks
    getAllRows().forEach((row, rowIndex) => {
      row.querySelectorAll('.conf-card').forEach((card, cardIndex) => {
        const header = card.querySelector('.conf-card-header');
        (header || card).addEventListener('click', (e) => {
          if (!e.target.closest('.conf-sub-card') && !e.target.closest('.conf-color-card')) {
            handleCardClick(card, rowIndex, cardIndex);
          }
        });
      });
    });

    // bind sub cards + colors
    document.addEventListener('click', (e) => {
      const colorTarget = e.target.closest('.color-swatch, .conf-color-card');
      if (colorTarget) {
        const colorCard = colorTarget.closest('.conf-color-card');
        if (colorCard) {
          const ids = getCardIndicesFromEl(colorCard);
          if (ids?.card) {
            e.preventDefault();
            ensureCardSelected(ids.card, ids.rowIndex, ids.cardIndex);
            handleColorCardClick(colorCard, ids.card, ids.cardId);
            return;
          }
        }
      }

      const subTarget = e.target.closest('.sub-card-content, .conf-sub-card');
      if (subTarget) {
        const subCard = subTarget.closest('.conf-sub-card');
        if (subCard) {
          const ids = getCardIndicesFromEl(subCard);
          if (ids?.card) {
            e.preventDefault();
            ensureCardSelected(ids.card, ids.rowIndex, ids.cardIndex);
            handleSubCardClick(subCard, ids.card, ids.cardId);
            return;
          }
        }
      }
    }, true);

    initializeExtras();

    // ✅ webhook binding to SEND button (form submit)
bindFormJsonOnlyWebhookAndFields();
    
    // final sync
    syncAutoTransportFee();
    updateSelectedEquipment();
    calculateTotal();

    // expose pdf generator if you ever want to call it after submit
    window.WOMONDO_generatePDF = generatePDF;

    log('READY ✅', window.WOMONDO_FINAL);
  }

  // Run
  document.addEventListener('DOMContentLoaded', () => {
    initialize().catch(err => console.error('[WOMONDO] init failed:', err));

    // =========================

  });
})();
