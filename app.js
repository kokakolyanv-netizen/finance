'use strict';

/* =====================================================================
   Мои финансы — офлайн-приложение учёта личных финансов.
   Данные хранятся на устройстве (localStorage) и синхронизируются
   с Google Таблицей через веб-приложение Apps Script, когда есть интернет.
   Операции можно вводить в любой валюте: они пересчитываются в основную
   валюту по курсу на дату операции (открытые курсы fawazahmed0/currency-api).
   ===================================================================== */

const APP_VERSION = '0.4.1';
const SEED_TIME = '2026-01-01T00:00:00.000Z';

// Базовые категории. ID совпадают с листом «Категории» в Google Таблице.
const DEFAULT_CATEGORIES = (() => {
  const list = [
    ['exp_food', 'Продукты'], ['exp_cafe', 'Кафе и рестораны'], ['exp_transport', 'Транспорт'],
    ['exp_car', 'Автомобиль'], ['exp_home', 'Жильё и ЖКХ'], ['exp_phone', 'Связь и интернет'],
    ['exp_health', 'Здоровье и аптека'], ['exp_clothes', 'Одежда и обувь'], ['exp_beauty', 'Красота и уход'],
    ['exp_fun', 'Развлечения'], ['exp_subs', 'Подписки'], ['exp_edu', 'Образование'], ['exp_kids', 'Дети'],
    ['exp_pets', 'Питомцы'], ['exp_gifts', 'Подарки'], ['exp_travel', 'Путешествия'], ['exp_sport', 'Спорт'],
    ['exp_house', 'Дом и ремонт'], ['exp_tech', 'Техника'], ['exp_credit', 'Кредиты и долги'],
    ['exp_taxes', 'Налоги и штрафы'], ['exp_charity', 'Благотворительность'], ['exp_other', 'Прочие расходы'],
    ['inc_salary', 'Зарплата'], ['inc_side', 'Подработка'], ['inc_bonus', 'Премии'], ['inc_business', 'Бизнес'],
    ['inc_interest', 'Проценты и кешбэк'], ['inc_invest', 'Инвестиции'], ['inc_gifts', 'Подарки'],
    ['inc_debt', 'Возврат долгов'], ['inc_sale', 'Продажа вещей'], ['inc_social', 'Пенсия и пособия'],
    ['inc_other', 'Прочие доходы']
  ];
  const counters = { expense: 0, income: 0 };
  return list.map(([id, name]) => {
    const type = id.startsWith('inc_') ? 'income' : 'expense';
    return { id, name, type, icon: 'tag', order: ++counters[type], hidden: false, updatedAt: SEED_TIME, srv: false, dirty: false };
  });
})();

const CURRENCIES = [
  { code: 'RUB', sym: '₽', name: 'Российский рубль' },
  { code: 'USD', sym: '$', name: 'Доллар США' },
  { code: 'EUR', sym: '€', name: 'Евро' },
  { code: 'GEL', sym: '₾', name: 'Грузинский лари' },
  { code: 'KZT', sym: '₸', name: 'Казахстанский тенге' },
  { code: 'BYN', sym: 'Br', name: 'Белорусский рубль' },
  { code: 'UAH', sym: '₴', name: 'Украинская гривна' },
  { code: 'AMD', sym: '֏', name: 'Армянский драм' },
  { code: 'AZN', sym: '₼', name: 'Азербайджанский манат' },
  { code: 'KGS', sym: 'сом', name: 'Киргизский сом' },
  { code: 'UZS', sym: 'сум', name: 'Узбекский сум' },
  { code: 'TRY', sym: '₺', name: 'Турецкая лира' },
  { code: 'GBP', sym: '£', name: 'Фунт стерлингов' },
  { code: 'CNY', sym: '¥', name: 'Китайский юань' },
  { code: 'AED', sym: 'AED', name: 'Дирхам ОАЭ' },
  { code: 'THB', sym: '฿', name: 'Тайский бат' }
];
const CUR = Object.fromEntries(CURRENCIES.map(c => [c.code, c]));
const CUR_CODES = CURRENCIES.map(c => c.code);
const SYMBOL_TO_CODE = { '₽': 'RUB', '$': 'USD', '€': 'EUR', '₾': 'GEL', '₸': 'KZT', 'Br': 'BYN', '₴': 'UAH', '֏': 'AMD' };
// Курсы на 07.11.2026 (единиц валюты за 1 USD): запасной вариант, если курсы ещё ни разу не загружались.
const FALLBACK_RATES = {
  date: '2026-11-07',
  r: { USD: 1, RUB: 82.002236, EUR: 0.897643, GEL: 2.594898, KZT: 448.253275, BYN: 2.997326, UAH: 45.286607,
    AMD: 360.330427, AZN: 1.702521, KGS: 87.458488, UZS: 12024.409371, TRY: 50.293023, GBP: 0.748926,
    CNY: 6.675493, AED: 3.6725, THB: 33.566623 }
};

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const TITLES = { home: 'Операции', reports: 'Отчёты', cats: 'Категории', settings: 'Настройки' };
// Цвета круговой диаграммы (проверены на различимость): 5 категорий + «Другое».
const DONUT_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
const DONUT_OTHER = 'var(--c-other)';

/* ===== Хранилище на устройстве ===== */

const KEYS = {
  tx: 'fin.tx.v1', cats: 'fin.cats.v1', settings: 'fin.settings.v1', meta: 'fin.meta.v1',
  rates: 'fin.rates.v1', ratefix: 'fin.ratefix.v1'
};

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    toast('Не удалось сохранить данные на устройстве');
  }
}

const S = {
  tx: readLS(KEYS.tx, []),
  cats: readLS(KEYS.cats, null) || DEFAULT_CATEGORIES.map(c => ({ ...c })),
  settings: Object.assign({ url: '', token: '', baseCurrency: '', recentCurrencies: [] }, readLS(KEYS.settings, {})),
  meta: Object.assign({ lastSync: 0, lastError: '' }, readLS(KEYS.meta, {}))
};
// Переход со старой настройки «валюта = символ» на код основной валюты.
if (!CUR[S.settings.baseCurrency]) S.settings.baseCurrency = SYMBOL_TO_CODE[S.settings.currency] || 'RUB';

const RATES = Object.assign({ latest: null, byDate: {} }, readLS(KEYS.rates, {}));
let RATE_FIX = readLS(KEYS.ratefix, []); // операции, для которых нужно уточнить курс по дате

const saveTx = () => writeLS(KEYS.tx, S.tx);
const saveCats = () => writeLS(KEYS.cats, S.cats);
const saveSettings = () => writeLS(KEYS.settings, S.settings);
const saveMeta = () => writeLS(KEYS.meta, S.meta);
const saveRates = () => writeLS(KEYS.rates, RATES);
const saveRateFix = () => writeLS(KEYS.ratefix, RATE_FIX);

const UI = {
  view: 'home',
  month: ymOf(todayStr()),   // выбранный месяц (общий для операций и отчётов)
  rMode: 'month',            // отчёт: month | year
  rKind: 'expense',          // структура: expense | income
  viewCur: '',               // валюта отчёта ('' = основная)
  catKind: 'expense',        // экран категорий
  catQ: '',                  // поиск на экране категорий
  syncing: false,
  syncAgain: false,
  modalOpen: false
};
let FORM = null; // состояние открытой формы

/* ===== Утилиты ===== */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function pad(n) { return String(n).padStart(2, '0'); }
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const nowIso = () => new Date().toISOString();
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();
const round6 = v => Math.round(v * 1e6) / 1e6;

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function ymOf(dateStr) { return dateStr.slice(0, 7); }
function addMonths(ym, k) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dayDiff(a, b) { return Math.abs(Math.round((parseDate(a) - parseDate(b)) / 86400000)); }
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
function shortDate(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}
function dayLabel(dateStr) {
  const today = todayStr();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
  const d = parseDate(dateStr);
  const base = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;
  if (dateStr === today) return 'Сегодня, ' + base;
  if (dateStr === yStr) return 'Вчера, ' + base;
  return base;
}
function monthPeriod(ym) {
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${pad(days)}`, days };
}
function yearPeriod(y) { return { from: `${y}-01-01`, to: `${y}-12-31` }; }
const inPeriod = (t, p) => t.date >= p.from && t.date <= p.to;

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfc = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const nfRate = new Intl.NumberFormat('ru-RU', { maximumSignificantDigits: 5 });
const base = () => S.settings.baseCurrency;
const sym = code => (CUR[code] || { sym: code }).sym;
function fmtNum(v) {
  const a = Math.abs(v);
  return (Math.abs(a - Math.round(a)) < 0.005 ? nf0 : nf2).format(a);
}
function fmtMoney(v, code) { return (v < 0 ? '−' : '') + fmtNum(v) + ' ' + sym(code || base()); }
function timeLabel(ts) {
  const d = new Date(ts);
  const sameDay = todayStr() === `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameDay ? hm : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${hm}`;
}
function parseAmount(s) {
  // «1 250,5» → 1250.5; «5,» → 5; «120+80» → 200; лишний «+» в конце не мешает.
  s = String(s || '').replace(/\s/g, '').replace(/,/g, '.').replace(/\++$/, '');
  const term = '(?:\\d+\\.?\\d*|\\.\\d+)';
  if (!new RegExp(`^${term}(?:\\+${term})*$`).test(s)) return NaN;
  const total = s.split('+').reduce((a, b) => a + Number(b), 0);
  return Math.round(total * 100) / 100;
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ===== Курсы валют ===== */

function pickTable(raw) {
  const r = { USD: 1 };
  CUR_CODES.forEach(c => {
    const v = Number(raw[c.toLowerCase()]);
    if (v > 0) r[c] = v;
  });
  return r;
}
async function fetchJSON(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
/** Таблица курсов «единиц валюты за 1 USD» на дату (tag = 'latest' или 'ГГГГ-ММ-ДД'); два зеркала. */
async function downloadTable(tag) {
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/usd.min.json`,
    `https://${tag}.currency-api.pages.dev/v1/currencies/usd.min.json`
  ];
  for (const u of urls) {
    try {
      const j = await fetchJSON(u, 8000);
      if (j && j.usd) return { date: j.date || tag, r: pickTable(j.usd) };
    } catch (e) { /* пробуем следующее зеркало */ }
  }
  return null;
}
async function refreshLatest(force) {
  if (RATES.latest && !force && Date.now() - RATES.latest.at < 6 * 3600 * 1000) return true;
  if (!navigator.onLine) return false;
  const t = await downloadTable('latest');
  if (!t) return false;
  RATES.latest = { date: t.date, at: Date.now(), r: t.r };
  saveRates();
  return true;
}
/** Точный курс на дату: из памяти или из сети. null — если сейчас недоступен. */
async function exactTable(date) {
  if (date >= todayStr()) return (await refreshLatest()) ? RATES.latest.r : null;
  if (RATES.byDate[date]) return RATES.byDate[date];
  if (!navigator.onLine) return null;
  const t = await downloadTable(date);
  if (!t) return null;
  RATES.byDate[date] = t.r;
  const dates = Object.keys(RATES.byDate).sort();
  dates.slice(0, Math.max(0, dates.length - 400)).forEach(d => { delete RATES.byDate[d]; });
  saveRates();
  return t.r;
}
/** Лучший курс без сети: точная дата, ближайшая известная дата или встроенный запасной. */
function approxTable(date) {
  if (RATES.byDate[date]) return { date, r: RATES.byDate[date], exact: true };
  if (RATES.latest && date >= todayStr()) return { date: RATES.latest.date, r: RATES.latest.r, exact: true };
  const cands = Object.keys(RATES.byDate).map(d => ({ date: d, r: RATES.byDate[d] }));
  if (RATES.latest) cands.push({ date: RATES.latest.date, r: RATES.latest.r });
  if (!cands.length) return { date: FALLBACK_RATES.date, r: FALLBACK_RATES.r, exact: false };
  cands.sort((a, b) => dayDiff(a.date, date) - dayDiff(b.date, date));
  return { date: cands[0].date, r: cands[0].r, exact: false };
}
/** Курс «сколько основной валюты за 1 единицу cur» без ожидания сети. */
function quickRate(cur, date) {
  const b = base();
  if (cur === b) return { rate: 1, exact: true, date };
  const t = approxTable(date);
  return { rate: round6(t.r[b] / t.r[cur]), exact: t.exact, date: t.date };
}
const txCur = t => t.currency || base();
const baseAmt = t => (txCur(t) === base() ? t.amount : t.amount * (t.rate > 0 ? t.rate : 1));

/** Уточняет курс по дате для операций, введённых без интернета. */
let refining = false;
async function refineRates() {
  if (refining || !RATE_FIX.length || !navigator.onLine) return;
  refining = true;
  try {
    const b = base();
    let changed = false;
    for (const id of RATE_FIX.slice()) {
      const t = S.tx.find(x => x.id === id);
      const drop = () => { RATE_FIX = RATE_FIX.filter(x => x !== id); };
      if (!t || t.deleted || txCur(t) === b) { drop(); continue; }
      const tbl = await exactTable(t.date);
      if (!tbl || !tbl[t.currency] || !tbl[b]) continue;
      const rate = round6(tbl[b] / tbl[t.currency]);
      if (rate !== t.rate) {
        Object.assign(t, { rate, updatedAt: nowIso(), dirty: true });
        changed = true;
      }
      drop();
    }
    saveRateFix();
    if (changed) saveTx();
  } finally {
    refining = false;
  }
}

/** Смена основной валюты: пересчёт всех операций по курсу на их даты. */
async function changeBase(newBase) {
  const old = base();
  if (newBase === old) return true;
  const live = liveTx();
  const need = live.filter(t => (t.currency || old) !== newBase);
  if (need.length && !confirm(`Сделать основной валютой «${CUR[newBase].name}»?\n\n` +
    `${need.length} операций пересчитаются по курсу на дату каждой операции.`)) return false;
  toast('Пересчитываю…');
  const dates = Array.from(new Set(need.map(t => t.date)));
  const tables = {};
  for (let i = 0; i < dates.length; i += 6) {
    const chunk = dates.slice(i, i + 6);
    const res = await Promise.all(chunk.map(d => exactTable(d).catch(() => null)));
    chunk.forEach((d, j) => { tables[d] = res[j]; });
  }
  const now = nowIso();
  live.forEach(t => {
    const cur = t.currency || old;
    let rate = 1;
    if (cur !== newBase) {
      const tbl = tables[t.date] || approxTable(t.date).r;
      rate = round6(tbl[newBase] / tbl[cur]);
      if (!tables[t.date] && !RATE_FIX.includes(t.id)) RATE_FIX.push(t.id);
    }
    if (t.currency !== cur || t.rate !== rate) Object.assign(t, { currency: cur, rate, updatedAt: now, dirty: true });
  });
  S.settings.baseCurrency = newBase;
  UI.viewCur = '';
  saveSettings();
  saveTx();
  saveRateFix();
  scheduleSync(300);
  return true;
}

function rememberCurrency(code) {
  const r = (S.settings.recentCurrencies || []).filter(c => c !== code);
  r.unshift(code);
  S.settings.recentCurrencies = r.slice(0, 4);
  saveSettings();
}
function currencyOptions(selected, withNames = true) {
  const order = [base(), ...(S.settings.recentCurrencies || []), ...CUR_CODES].filter((c, i, a) => CUR[c] && a.indexOf(c) === i);
  return order.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${esc(CUR[c].sym)} ${c}${withNames ? ' · ' + esc(CUR[c].name) : ''}</option>`).join('');
}
function curPick(id, selected, cls = '') {
  return `<label class="cur-pick ${cls}"><span class="cp-label">${esc(curLabel(selected))}</span>${icon('chevron-down')}
    <select id="${id}" aria-label="Валюта">${currencyOptions(selected)}</select></label>`;
}
const curLabel = c => (CUR[c].sym === c ? c : `${CUR[c].sym} ${c}`);

/* ===== Данные ===== */

const liveTx = () => S.tx.filter(t => !t.deleted);
// Цвет кнопки категории: по её порядковому номеру, 12 градиентов по кругу (новые категории получают следующий).
const catColor = c => 'g' + ((((Number(c.order) || 1) - 1) % 12) + 12) % 12;
const catMap = () => Object.fromEntries(S.cats.map(c => [c.id, c]));
const UNKNOWN_CAT = { name: 'Без категории' };
const sumType = (list, type) => list.reduce((a, t) => a + (t.type === type ? baseAmt(t) : 0), 0);
const dirtyCount = () => S.tx.filter(t => t.dirty).length + S.cats.filter(c => c.dirty).length;

function upsertTx(f) {
  const now = nowIso();
  const i = S.tx.findIndex(t => t.id === f.id);
  const rec = {
    date: f.date, type: f.type, amount: f.amount, currency: f.currency, rate: f.rate,
    categoryId: f.categoryId, comment: f.comment, updatedAt: now, dirty: true
  };
  let id = f.id;
  if (i >= 0) S.tx[i] = { ...S.tx[i], ...rec };
  else {
    id = uid();
    S.tx.push({ id, createdAt: now, srv: false, deleted: false, ...rec });
  }
  RATE_FIX = RATE_FIX.filter(x => x !== id);
  if (f.rateApprox) RATE_FIX.push(id);
  saveRateFix();
  saveTx();
  scheduleSync();
}

function deleteTx(id) {
  const t = S.tx.find(x => x.id === id);
  if (!t) return;
  if (S.settings.url || t.srv) {
    // «Надгробие»: удаление уйдёт в таблицу при следующей синхронизации.
    Object.assign(t, { deleted: true, dirty: true, updatedAt: nowIso() });
  } else {
    S.tx = S.tx.filter(x => x.id !== id);
  }
  saveTx();
  scheduleSync();
}

function upsertCat(c) {
  const now = nowIso();
  const i = S.cats.findIndex(x => x.id === c.id);
  if (i >= 0) S.cats[i] = { ...S.cats[i], ...c, updatedAt: now, dirty: true };
  else {
    const order = Math.max(0, ...S.cats.filter(x => x.type === c.type).map(x => x.order || 0)) + 1;
    S.cats.push({ id: 'c_' + uid().slice(0, 8), icon: 'tag', order, hidden: false, srv: false, ...c, updatedAt: now, dirty: true });
  }
  saveCats();
  scheduleSync();
  return c.id || S.cats[S.cats.length - 1].id;
}

/* ===== Синхронизация с Google Таблицей ===== */

let syncTimer = null;
function scheduleSync(delay = 1500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(false), delay);
  renderBadge();
}

const stripLocal = r => {
  const { dirty, srv, ...rest } = r;
  return rest;
};

/**
 * Итог после ответа сервера: записи сервера + локальные записи,
 * изменённые уже во время запроса (их отправим в следующий раз).
 */
function mergeServer(local, server, sent) {
  const out = new Map();
  server.forEach(r => out.set(r.id, { ...r, srv: true, dirty: false }));
  local.forEach(l => {
    if (!l.dirty) return;
    if (sent.get(l.id) === l.updatedAt) return; // отправлено и обработано сервером
    out.set(l.id, { ...l, srv: l.srv || out.has(l.id) });
  });
  return Array.from(out.values());
}

async function sync(manual) {
  const { url, token } = S.settings;
  if (!url || !token) {
    if (manual) toast('Укажите адрес и ключ в настройках');
    renderBadge();
    return;
  }
  if (!navigator.onLine) {
    if (manual) toast('Нет интернета. Данные отправятся позже');
    renderBadge();
    return;
  }
  if (UI.syncing) { UI.syncAgain = true; return; }

  UI.syncing = true;
  renderBadge();
  try { await refineRates(); } catch (e) { /* курсы уточним в следующий раз */ }
  const sentTx = S.tx.filter(t => t.dirty).map(stripLocal);
  const sentCats = S.cats.filter(c => c.dirty).map(stripLocal);
  const sent = new Map();
  sentTx.concat(sentCats).forEach(r => sent.set(r.id, r.updatedAt));
  let ok = false;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    let res;
    try {
      // text/plain без своих заголовков — Apps Script принимает такой запрос без CORS-предзапроса.
      res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ token, transactions: sentTx, categories: sentCats }),
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error('Сервер ответил кодом ' + res.status);
    let data;
    try { data = await res.json(); } catch (e) {
      throw new Error('Неожиданный ответ. Проверьте адрес веб-приложения');
    }
    if (!data.ok) throw new Error(data.error || 'Ошибка на стороне таблицы');
    if (!Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
      throw new Error('Неполный ответ от таблицы');
    }

    // Защита: таблицу очистили, а на телефоне есть уже синхронизированные операции.
    const syncedLocal = S.tx.filter(t => t.srv && !t.deleted && !t.dirty).length;
    if (data.transactions.length === 0 && syncedLocal > 0) {
      const wipe = confirm(`В таблице нет ни одной операции, а на телефоне их ${syncedLocal}.\n\n` +
        'ОК: удалить их и на телефоне.\nОтмена: отправить операции с телефона обратно в таблицу.');
      if (!wipe) {
        S.tx.forEach(t => { if (!t.deleted) { t.dirty = true; t.srv = false; } });
        saveTx();
        UI.syncAgain = true;
        return;
      }
    }

    S.tx = mergeServer(S.tx, data.transactions, sent);
    if (data.categories.length) {
      S.cats = mergeServer(S.cats, data.categories, sent);
    } else {
      // Лист категорий пуст: отправим свои категории заново.
      S.cats.forEach(c => { c.dirty = true; });
      UI.syncAgain = true;
    }
    saveTx();
    saveCats();
    S.meta.lastSync = Date.now();
    S.meta.lastError = '';
    saveMeta();
    ok = true;
  } catch (e) {
    S.meta.lastError = e.name === 'AbortError' ? 'Превышено время ожидания ответа'
      : e instanceof TypeError ? 'Нет связи с таблицей: нет интернета, неверный адрес или доступ к веб-приложению не «Все»'
      : (e.message || String(e));
    saveMeta();
  } finally {
    UI.syncing = false;
    refreshAfterSync();
    if (manual) toast(ok ? 'Синхронизировано' : S.meta.lastError ? 'Ошибка: ' + S.meta.lastError : 'Отправляю заново…');
    if (UI.syncAgain) {
      UI.syncAgain = false;
      scheduleSync(300);
    }
  }
}

/* ===== Отрисовка: общее ===== */

function renderBadge() {
  const b = $('#syncBadge');
  if (!b) return;
  const n = dirtyCount();
  let text;
  let cls;
  if (!S.settings.url) { text = 'Только на устройстве'; cls = 'muted'; }
  else if (UI.syncing) { text = 'Синхронизация…'; cls = 'busy'; }
  else if (!navigator.onLine) { text = n ? `Офлайн · ждут: ${n}` : 'Офлайн'; cls = 'offline'; }
  else if (S.meta.lastError) { text = 'Ошибка синхронизации'; cls = 'error'; }
  else if (n) { text = `Ждут отправки: ${n}`; cls = 'pending'; }
  else { text = S.meta.lastSync ? `Синхр. ${timeLabel(S.meta.lastSync)}` : 'Не синхронизировано'; cls = S.meta.lastSync ? 'ok' : 'pending'; }
  b.textContent = text;
  b.className = 'badge ' + cls;
}

function renderAll() {
  renderBadge();
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === UI.view));
  $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + UI.view; });
  $('#fab').hidden = !(UI.view === 'home' || UI.view === 'reports');
  $('#title').textContent = TITLES[UI.view];
  ({ home: renderHome, reports: renderReports, cats: renderCats, settings: renderSettings })[UI.view]();
}

function refreshAfterSync() {
  if (UI.view === 'settings') { renderBadge(); updateSyncInfo(); }
  else if (UI.view === 'cats') { renderBadge(); renderCatList(); }
  else renderAll();
}

function monthSwitch(label) {
  return `<div class="month-switch">
    <button type="button" class="icon-btn soft" data-act="prev" aria-label="Назад">${icon('chevron-left')}</button>
    <span class="label">${esc(label)}</span>
    <button type="button" class="icon-btn soft" data-act="next" aria-label="Вперёд">${icon('chevron-right')}</button>
  </div>`;
}

function emptyHTML(title, sub, small) {
  return `<div class="empty${small ? ' small' : ''}"><div class="empty-title">${esc(title)}</div>
    ${sub ? `<div class="empty-sub">${esc(sub)}</div>` : ''}</div>`;
}

function txListHTML(list) {
  const cm = catMap();
  const sorted = list.slice().sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.createdAt < b.createdAt ? 1 : -1));
  const days = [];
  sorted.forEach(t => {
    const last = days[days.length - 1];
    if (last && last.date === t.date) last.items.push(t);
    else days.push({ date: t.date, items: [t] });
  });
  return days.map(d => {
    const exp = sumType(d.items, 'expense');
    const rows = d.items.map(t => {
      const c = cm[t.categoryId] || UNKNOWN_CAT;
      const sign = t.type === 'income' ? '+' : '−';
      const cur = txCur(t);
      const foreign = cur !== base();
      return `<button type="button" class="tx" data-act="open-tx" data-id="${esc(t.id)}">
        <span class="tx-main"><span class="tx-cat">${esc(c.name)}</span>${t.comment ? `<span class="tx-com">${esc(t.comment)}</span>` : ''}</span>
        <span class="tx-amts"><span class="tx-amt ${t.type}">${sign}${esc(fmtNum(t.amount))}&nbsp;${esc(sym(cur))}</span>
          ${foreign ? `<span class="tx-base">≈ ${esc(fmtMoney(baseAmt(t)))}</span>` : ''}</span>
        ${t.dirty ? '<span class="dot" title="Ещё не отправлено в таблицу"></span>' : ''}
      </button>`;
    }).join('');
    return `<div class="day"><div class="day-head"><span>${esc(dayLabel(d.date))}</span>
      <span class="num">${exp ? '−' + esc(fmtMoney(exp)) : ''}</span></div><div class="day-list">${rows}</div></div>`;
  }).join('');
}

/* ===== Экран «Операции» ===== */

function renderHome() {
  const p = monthPeriod(UI.month);
  const list = liveTx().filter(t => inPeriod(t, p));
  const inc = sumType(list, 'income');
  const exp = sumType(list, 'expense');
  const m = Number(UI.month.slice(5, 7));
  $('#view-home').innerHTML = `
    ${monthSwitch(monthLabel(UI.month))}
    <section class="hero">
      <div class="hero-label">Баланс за ${esc(MONTHS[m - 1].toLowerCase())}</div>
      <div class="hero-value">${esc(fmtMoney(inc - exp))}</div>
      <div class="hero-row">
        <div class="mini"><div class="mini-label">Доходы</div><div class="mini-value ${inc ? 'in' : ''}">${inc ? '+' : ''}${esc(fmtMoney(inc))}</div></div>
        <div class="mini"><div class="mini-label">Расходы</div><div class="mini-value">${exp ? '−' : ''}${esc(fmtMoney(exp))}</div></div>
      </div>
    </section>
    ${list.length ? txListHTML(list) : emptyHTML('Операций пока нет', 'Нажмите «+», чтобы добавить первую')}`;
}

/* ===== Экран «Отчёты» ===== */

function deltaHTML(curV, prevV, upIsGood, prevLabel) {
  if (!prevV) return '<div class="k-delta">&nbsp;</div>';
  const pct = (curV - prevV) / prevV * 100;
  if (Math.abs(pct) < 0.5) return '<div class="k-delta">≈ без изменений</div>';
  const up = pct > 0;
  const good = up === upIsGood;
  return `<div class="k-delta ${good ? 'good' : 'bad'}">${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% к ${esc(prevLabel)}</div>`;
}

function kpi(label, value, extra = '', swatch = '') {
  return `<div class="kpi"><div class="k-label">${swatch ? `<span class="swatch ${swatch}"></span>` : ''}${esc(label)}</div>
    <div class="k-value">${esc(value)}</div>${extra}</div>`;
}

function daysElapsed(p) {
  const today = todayStr();
  if (today < p.from) return 0;
  const end = today < p.to ? today : p.to;
  return Math.round((parseDate(end) - parseDate(p.from)) / 86400000) + 1;
}

function reportPeriod() {
  const isYear = UI.rMode === 'year';
  const y = Number(UI.month.slice(0, 4));
  return { isYear, y, p: isYear ? yearPeriod(y) : monthPeriod(UI.month), label: isYear ? `${y} год` : monthLabel(UI.month) };
}

/** Пересчёт итогов из основной валюты в валюту отчёта по текущему курсу. */
function viewConversion() {
  const view = UI.viewCur || base();
  if (view === base()) return { cur: view, k: 1, note: '' };
  const t = approxTable(todayStr());
  const k = t.r[view] / t.r[base()];
  const pair = k < 1 ? `1 ${sym(view)} = ${nfRate.format(1 / k)} ${sym(base())}` : `1 ${sym(base())} = ${nfRate.format(k)} ${sym(view)}`;
  return { cur: view, k, note: `Суммы пересчитаны из ${base()} в ${view} по курсу на ${shortDate(t.date)}: ${pair}` };
}

function renderReports() {
  const { isYear, y, p, label } = reportPeriod();
  const m = Number(UI.month.slice(5, 7));
  const pp = isYear ? yearPeriod(y - 1) : monthPeriod(addMonths(UI.month, -1));
  const prevLabel = isYear ? String(y - 1) : MONTHS_DAT[(m + 10) % 12];
  const { cur: vc, k, note } = viewConversion();
  const money = v => fmtMoney(v, vc);
  const all = liveTx();
  const curList = all.filter(t => inPeriod(t, p));
  const prevList = all.filter(t => inPeriod(t, pp));
  const inc = sumType(curList, 'income') * k;
  const exp = sumType(curList, 'expense') * k;

  const days = daysElapsed(p);
  let avg;
  if (isYear) {
    const monthsElapsed = days ? (todayStr().slice(0, 4) === String(y) ? Number(todayStr().slice(5, 7)) : 12) : 0;
    avg = monthsElapsed ? exp / monthsElapsed : 0;
  } else {
    avg = days ? exp / days : 0;
  }

  // Структура по категориям → круговая диаграмма
  const kind = UI.rKind;
  const cm = catMap();
  const byCat = {};
  curList.filter(t => t.type === kind).forEach(t => { byCat[t.categoryId] = (byCat[t.categoryId] || 0) + baseAmt(t) * k; });
  const items = Object.entries(byCat).map(([id, v]) => ({ id, v, c: cm[id] || UNKNOWN_CAT })).sort((a, b) => b.v - a.v);
  const total = kind === 'expense' ? exp : inc;
  const folded = items.length > 5;
  const segs = (folded ? items.slice(0, 5) : items).map((it, i) => ({ label: it.c.name, value: it.v, color: DONUT_COLORS[i], ids: [it.id] }));
  if (folded) {
    const rest = items.slice(5);
    segs.push({ label: rest.length === 1 ? rest[0].c.name : 'Другое', value: rest.reduce((a, it) => a + it.v, 0), color: DONUT_OTHER, ids: rest.map(it => it.id) });
  }
  const segOf = {};
  segs.forEach((s, i) => s.ids.forEach(id => { segOf[id] = i; }));
  const legend = items.map(it => {
    const si = segOf[it.id];
    const pct = total ? it.v / total * 100 : 0;
    return `<button type="button" class="lg-row" data-act="drill" data-id="${esc(it.id)}" data-seg="${si}">
      <span class="lg-dot" style="background:${segs[si].color}"></span>
      <span class="lg-main"><span class="lg-name">${esc(it.c.name)}</span>
        <span class="lg-pct">${pct < 1 ? 'меньше 1' : Math.round(pct)}%</span></span>
      <span class="lg-val">${esc(money(it.v))}</span>
    </button>`;
  }).join('');

  // Помесячная динамика
  const months = isYear
    ? Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`)
    : Array.from({ length: 6 }, (_, i) => addMonths(UI.month, i - 5));
  const byMonth = {};
  all.forEach(t => {
    const key = ymOf(t.date);
    const o = byMonth[key] || (byMonth[key] = { income: 0, expense: 0 });
    o[t.type] += baseAmt(t) * k;
  });
  const incV = months.map(key => (byMonth[key] || {}).income || 0);
  const expV = months.map(key => (byMonth[key] || {}).expense || 0);
  const tableRows = months.map((key, i) => `<tr><td>${esc(monthLabel(key))}</td><td>${esc(fmtNum(incV[i]))}</td>
    <td>${esc(fmtNum(expV[i]))}</td><td>${esc((incV[i] - expV[i] < 0 ? '−' : '') + fmtNum(incV[i] - expV[i]))}</td></tr>`).join('');

  $('#view-reports').innerHTML = `
    <div class="report-top">
      <div class="seg">
        <button type="button" data-act="rmode" data-mode="month" class="${isYear ? '' : 'on'}">Месяц</button>
        <button type="button" data-act="rmode" data-mode="year" class="${isYear ? 'on' : ''}">Год</button>
      </div>
      ${curPick('rep-cur', vc, 'small')}
    </div>
    ${note ? `<p class="rate-note">${esc(note)}</p>` : ''}
    ${monthSwitch(label)}
    <div class="kpis">
      ${kpi('Доходы', money(inc), deltaHTML(inc, sumType(prevList, 'income') * k, true, prevLabel), 'income')}
      ${kpi('Расходы', money(exp), deltaHTML(exp, sumType(prevList, 'expense') * k, false, prevLabel), 'expense')}
      ${kpi('Баланс', money(inc - exp), `<div class="k-delta">${!inc ? '&nbsp;'
        : inc >= exp ? `Осталось ${Math.round((inc - exp) / inc * 100)}% дохода` : 'Расходы больше доходов'}</div>`)}
      ${kpi(isYear ? 'Расход в месяц' : 'Расход в день', money(avg), '<div class="k-delta">в среднем</div>')}
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Структура ${kind === 'expense' ? 'расходов' : 'доходов'}</h3>
        <div class="seg">
          <button type="button" data-act="rkind" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">Расходы</button>
          <button type="button" data-act="rkind" data-kind="income" class="${kind === 'income' ? 'on' : ''}">Доходы</button>
        </div>
      </div>
      ${items.length ? `
        <div class="donut-wrap" id="donut">${donutSVG(segs, total)}
          <div class="donut-center"><div class="dc-label"></div><div class="dc-value"></div><div class="dc-sub"></div></div>
        </div>
        <div class="legend-list">${legend}</div>
        <p class="hint">Нажмите на категорию, чтобы увидеть её операции.</p>`
      : emptyHTML('Нет данных за этот период', '', true)}
    </div>

    <div class="card">
      <h3>Доходы и расходы</h3>
      <p class="sub">${isYear ? `По месяцам, ${y} год` : 'Последние 6 месяцев'}</p>
      <div class="legend"><span><span class="swatch income"></span>Доходы</span><span><span class="swatch expense"></span>Расходы</span></div>
      <div id="chart-months" class="chart"></div>
      <details class="table-view"><summary>${icon('chevron-right')}Показать таблицей</summary>
        <table class="data"><thead><tr><th>Месяц</th><th>Доходы</th><th>Расходы</th><th>Баланс</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </details>
    </div>

    ${isYear ? '' : `<div class="card">
      <h3>Расходы по дням</h3>
      <p class="sub">${esc(monthLabel(UI.month))}</p>
      <div id="chart-days" class="chart" style="margin-top:12px"></div>
    </div>`}`;

  $('#rep-cur').addEventListener('change', e => { UI.viewCur = e.target.value; renderReports(); });

  if (items.length) {
    bindDonut($('#donut'), segs, total, {
      label: kind === 'expense' ? 'Расходы' : 'Доходы',
      value: money(total),
      sub: label
    }, vc);
  }

  columnChart($('#chart-months'), {
    title: 'Доходы и расходы по месяцам',
    cur: vc,
    labels: months.map(key => MONTHS_SHORT[Number(key.slice(5, 7)) - 1]),
    tipLabels: months.map(monthLabel),
    series: [{ name: 'Доходы', cls: 'income', values: incV }, { name: 'Расходы', cls: 'expense', values: expV }],
    showLabel: (i, band) => band >= 28 || i % 2 === 0
  });

  if (!isYear) {
    const daily = Array(p.days).fill(0);
    curList.forEach(t => { if (t.type === 'expense') daily[Number(t.date.slice(8, 10)) - 1] += baseAmt(t) * k; });
    columnChart($('#chart-days'), {
      title: 'Расходы по дням',
      cur: vc,
      labels: daily.map((_, i) => String(i + 1)),
      tipLabels: daily.map((_, i) => `${i + 1} ${MONTHS_GEN[m - 1]}`),
      series: [{ name: 'Расходы', cls: 'expense', values: daily }],
      showLabel: i => i === 0 || (i + 1) % 5 === 0
    });
  }
}

/* ----- Круговая диаграмма (кольцо) ----- */

function donutSVG(segs, total) {
  const c = 112;
  const R = 106;
  const r = 82;
  const GAP = 3; // зазор между сегментами, px
  if (segs.length === 1) {
    return `<svg viewBox="0 0 224 224" role="img" aria-label="Круговая диаграмма">
      <path class="donut-seg" data-i="0" style="fill:${segs[0].color}" fill-rule="evenodd"
        d="M${c - R} ${c}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0zM${c - r} ${c}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0z"/></svg>`;
  }
  const pt = (rad, a) => `${(c + rad * Math.sin(a)).toFixed(2)} ${(c - rad * Math.cos(a)).toFixed(2)}`;
  let a = 0;
  const paths = segs.map((s, i) => {
    const span = s.value / total * 2 * Math.PI;
    const a0 = a;
    const a1 = a + span;
    a = a1;
    let po = GAP / 2 / R;
    let pi = GAP / 2 / r;
    if (span <= 2 * pi + 0.004) { po = 0; pi = 0; }
    const o0 = a0 + po, o1 = a1 - po, i0 = a0 + pi, i1 = a1 - pi;
    const lo = o1 - o0 > Math.PI ? 1 : 0;
    const li = i1 - i0 > Math.PI ? 1 : 0;
    return `<path class="donut-seg" data-i="${i}" style="fill:${s.color}"
      d="M${pt(R, o0)}A${R} ${R} 0 ${lo} 1 ${pt(R, o1)}L${pt(r, i1)}A${r} ${r} 0 ${li} 0 ${pt(r, i0)}Z"/>`;
  }).join('');
  return `<svg viewBox="0 0 224 224" role="img" aria-label="Круговая диаграмма">${paths}</svg>`;
}

function bindDonut(wrap, segs, total, def, cur) {
  if (!wrap) return;
  const center = wrap.querySelector('.donut-center');
  const [lab, val, sub] = center.children;
  let selected = -1;
  const show = i => {
    selected = i;
    wrap.classList.toggle('has-sel', i >= 0);
    wrap.querySelectorAll('.donut-seg').forEach(p => p.classList.toggle('sel', Number(p.dataset.i) === i));
    $$('.lg-row').forEach(row => row.classList.toggle('hl', i >= 0 && Number(row.dataset.seg) === i));
    if (i < 0) {
      lab.textContent = def.label;
      val.textContent = def.value;
      sub.textContent = def.sub;
    } else {
      const s = segs[i];
      lab.textContent = s.label;
      val.textContent = fmtMoney(s.value, cur);
      const pct = s.value / total * 100;
      sub.textContent = `${pct < 1 ? 'меньше 1' : Math.round(pct)}% от суммы`;
    }
  };
  show(-1);
  wrap.querySelectorAll('.donut-seg').forEach(p => {
    const i = Number(p.dataset.i);
    p.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(i); });
    p.addEventListener('click', () => show(selected === i ? -1 : i));
  });
  wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') show(-1); });
  $$('.lg-row').forEach(row => {
    row.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(Number(row.dataset.seg)); });
    row.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') show(-1); });
  });
}

/* ----- Столбчатая диаграмма ----- */

// «Круглые» деления оси: из вариантов на 4–6 делений берём тот, что ближе всего к максимуму.
function niceTicks(max) {
  let best = null;
  [4, 5, 6].forEach(count => {
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    const top = Math.ceil(max / step - 1e-9) * step;
    if (!best || top < best.top) best = { top, step };
  });
  const ticks = [];
  for (let v = 0; v <= best.top + best.step / 2; v += best.step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function barPath(x, y, w, h, r) {
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
}

/** Столбчатая диаграмма (одна или несколько серий) с подсказкой при наведении/касании. */
function columnChart(box, cfg) {
  if (!box) return;
  const W = Math.max(260, Math.floor(box.clientWidth || 320));
  const H = 190;
  const n = cfg.labels.length;
  const k = cfg.series.length;
  const maxV = Math.max(0, ...cfg.series.flatMap(s => s.values));
  if (maxV <= 0) { box.innerHTML = emptyHTML('Нет данных за этот период', '', true); return; }
  const ticks = niceTicks(maxV);
  const top = ticks[ticks.length - 1];
  const compact = top >= 10000;
  const fmtAxis = v => (compact ? nfc : nf0).format(v);
  // Левое поле под самую длинную подпись оси, чтобы «200 тыс.» не обрезалось.
  const longest = Math.max(...ticks.map(v => fmtAxis(v).length));
  const m = { l: Math.ceil(longest * 7) + 12, r: 4, t: 12, b: 24 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const band = pw / n;
  const gap = 2;
  const bw = Math.max(2, Math.min(18, (band * 0.62 - gap * (k - 1)) / k));
  const gw = bw * k + gap * (k - 1);
  const base0 = m.t + ph;
  const parts = [`<rect class="hl" x="0" y="${m.t}" width="${band}" height="${ph}" rx="8" visibility="hidden"/>`];
  ticks.forEach(v => {
    const yy = Math.round(base0 - v / top * ph) + 0.5;
    if (v > 0) parts.push(`<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/>`);
    parts.push(`<text class="tick" x="${m.l - 8}" y="${yy + 4}" text-anchor="end">${esc(fmtAxis(v))}</text>`);
  });
  for (let i = 0; i < n; i++) {
    const x0 = m.l + band * i + (band - gw) / 2;
    cfg.series.forEach((s, j) => {
      const v = s.values[i];
      if (!(v > 0)) return;
      const h = Math.max(1, v / top * ph);
      const x = x0 + j * (bw + gap);
      parts.push(`<path class="bar ${s.cls}" d="${barPath(x, base0 - h, bw, h, Math.min(4, bw / 2, h))}"/>`);
    });
    if (cfg.showLabel(i, band)) {
      parts.push(`<text class="xlab" x="${m.l + band * i + band / 2}" y="${H - 6}" text-anchor="middle">${esc(cfg.labels[i])}</text>`);
    }
  }
  parts.push(`<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${base0 + 0.5}" y2="${base0 + 0.5}"/>`);
  box.innerHTML = `<div class="chart-wrap"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.title)}">${parts.join('')}</svg><div class="tip" hidden></div></div>`;

  const wrap = box.firstElementChild;
  const svg = wrap.querySelector('svg');
  const tip = wrap.querySelector('.tip');
  const hl = svg.querySelector('.hl');
  const hide = () => { tip.hidden = true; hl.setAttribute('visibility', 'hidden'); };
  const show = ev => {
    const r = svg.getBoundingClientRect();
    const i = Math.floor((ev.clientX - r.left - m.l) / band);
    if (i < 0 || i >= n) { hide(); return; }
    hl.setAttribute('x', m.l + band * i);
    hl.setAttribute('visibility', 'visible');
    tip.replaceChildren();
    const head = document.createElement('div');
    head.className = 'tip-head';
    head.textContent = cfg.tipLabels[i];
    tip.append(head);
    cfg.series.forEach(s => {
      const row = document.createElement('div');
      row.className = 'tip-row';
      const key = document.createElement('span');
      key.className = 'tip-key ' + s.cls;
      const v = document.createElement('strong');
      v.textContent = fmtMoney(s.values[i], cfg.cur);
      const name = document.createElement('span');
      name.className = 'tip-name';
      name.textContent = s.name;
      row.append(key, v, name);
      tip.append(row);
    });
    tip.hidden = false;
    const cx = m.l + band * i + band / 2;
    const tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(W - tw, cx - tw / 2)) + 'px';
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
}

function openDrill(catId) {
  const { p, label } = reportPeriod();
  const { cur: vc, k } = viewConversion();
  const c = catMap()[catId] || UNKNOWN_CAT;
  const list = liveTx().filter(t => t.categoryId === catId && t.type === UI.rKind && inPeriod(t, p));
  const total = list.reduce((a, t) => a + baseAmt(t), 0) * k;
  openModal(c.name, `
    <p class="sub" style="margin:0 4px 16px;text-align:center">${esc(label)} · ${esc(fmtMoney(total, vc))} · операций: ${list.length}</p>
    ${txListHTML(list)}`);
}

/* ===== Экран «Категории» ===== */

function renderCats() {
  const kind = UI.catKind;
  $('#view-cats').innerHTML = `
    <div class="toolbar">
      <div class="seg">
        <button type="button" data-act="ckind" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">Расходы</button>
        <button type="button" data-act="ckind" data-kind="income" class="${kind === 'income' ? 'on' : ''}">Доходы</button>
      </div>
      <button type="button" class="btn primary small" data-act="new-cat">${icon('plus')}Новая</button>
    </div>
    <div class="search-wrap"><div class="field"><input id="cat-search" type="search" placeholder="Поиск категории" autocomplete="off" value="${esc(UI.catQ)}"></div></div>
    <div id="cat-list"></div>
    <p class="hint">Число справа: сколько операций в категории. Скрытые категории не предлагаются при вводе, но остаются в отчётах.</p>`;
  $('#cat-search').addEventListener('input', e => { UI.catQ = e.target.value; renderCatList(); });
  renderCatList();
}

function renderCatList() {
  const box = $('#cat-list');
  if (!box) return;
  const q = norm(UI.catQ);
  const counts = {};
  liveTx().forEach(t => { counts[t.categoryId] = (counts[t.categoryId] || 0) + 1; });
  const list = S.cats.filter(c => c.type === UI.catKind && (!q || norm(c.name).includes(q)))
    .sort((a, b) => (a.hidden - b.hidden) || (a.order - b.order) || a.name.localeCompare(b.name, 'ru'));
  box.innerHTML = list.length ? `<div class="card list-card">
      ${list.map(c => `<button type="button" class="cat-row ${c.hidden ? 'hidden-cat' : ''}" data-act="edit-cat" data-id="${esc(c.id)}">
        <span class="cat-swatch ${catColor(c)}"></span>
        <span class="name">${esc(c.name)}</span>
        ${c.hidden ? '<span class="tag">скрыта</span>' : ''}
        ${c.dirty ? '<span class="dot" title="Ещё не отправлено в таблицу"></span>' : ''}
        <span class="count">${counts[c.id] || 0}</span>
        ${icon('chevron-right', 'chev')}
      </button>`).join('')}
    </div>` : emptyHTML('Ничего не найдено', q ? 'Попробуйте другое слово или создайте категорию' : '', true);
}

function openCatForm(cat, opts = {}) {
  const isNew = !cat;
  FORM = {
    kind: 'cat',
    id: cat ? cat.id : null,
    type: cat ? cat.type : (opts.type || UI.catKind),
    onSaved: opts.onSaved || null,
    onCancel: opts.onCancel || null
  };
  const used = cat ? liveTx().filter(t => t.categoryId === cat.id).length : 0;
  openModal(isNew ? 'Новая категория' : 'Категория', `
    <label class="field-label" for="cf-name" style="margin-top:4px">Название</label>
    <div class="field"><input id="cf-name" maxlength="40" autocomplete="off" value="${esc(cat ? cat.name : (opts.name || ''))}" placeholder="Например, Кофе"></div>
    ${isNew ? `<div class="seg wide" id="cf-type" style="margin-top:14px">
      <button type="button" data-act="cf-type" data-type="expense" class="${FORM.type === 'expense' ? 'on' : ''}">Расход</button>
      <button type="button" data-act="cf-type" data-type="income" class="${FORM.type === 'income' ? 'on' : ''}">Доход</button>
    </div>` : `<p class="sub" style="margin:12px 4px 0">${cat.type === 'income' ? 'Категория доходов' : 'Категория расходов'} · операций: ${used}</p>`}
    ${isNew ? '' : `<label class="switch-row"><span>Скрыть категорию</span><input type="checkbox" class="switch" id="cf-hidden" ${cat.hidden ? 'checked' : ''}></label>`}
    <div class="error-text" id="cf-err"></div>
    <div class="form-actions"><button type="button" class="btn primary block" data-act="cf-save">Сохранить</button></div>`);
  if (isNew) setTimeout(() => $('#cf-name') && $('#cf-name').focus(), 50);
}

function saveCatForm() {
  const name = $('#cf-name').value.trim();
  const err = $('#cf-err');
  if (!name) { err.textContent = 'Введите название'; return; }
  const dup = S.cats.find(c => c.type === FORM.type && c.id !== FORM.id && norm(c.name) === norm(name));
  if (dup) { err.textContent = 'Такая категория уже есть'; return; }
  const rec = { name, type: FORM.type };
  if (FORM.id) {
    rec.id = FORM.id;
    rec.hidden = $('#cf-hidden').checked;
  }
  const id = upsertCat(rec);
  const cb = FORM.onSaved;
  if (cb) cb(id);
  else { closeModal(); toast('Категория сохранена'); renderAll(); }
}

/* ===== Форма операции ===== */

function catChipsHTML() {
  const qRaw = (FORM.q || '').trim();
  const q = norm(qRaw);
  const list = S.cats.filter(c => c.type === FORM.type && (!c.hidden || c.id === FORM.categoryId) && (!q || norm(c.name).includes(q)))
    .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, 'ru'));
  let html = list.map(c => `<button type="button" class="chip colored ${catColor(c)} ${c.id === FORM.categoryId ? 'on' : ''}" data-act="tx-cat" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  const exact = q && S.cats.some(c => c.type === FORM.type && !c.hidden && norm(c.name) === q);
  if (q && !list.length) html = '<p class="hint">Такой категории нет.</p>';
  if (q && !exact) html += `<button type="button" class="chip add" data-act="tx-quickcat">+ Создать «${esc(qRaw)}»</button>`;
  if (!q) html += '<button type="button" class="chip add" data-act="tx-newcat">+ Новая категория</button>';
  return html;
}
function renderChips() { $('#tx-cats').innerHTML = catChipsHTML(); }

/* ----- Поле суммы ----- */

const AMOUNT_FONT = 46;      // базовый размер цифр, px
const AMOUNT_FONT_MIN = 16;  // меньше не уменьшаем
const GROUP_SEP = ' ';  // неразрывный пробел между разрядами

/**
 * Приводит ввод к виду «1 250 000,75»: только цифры, одна запятая (точка тоже превращается в запятую),
 * не больше двух знаков после запятой и 12 цифр до неё, без ведущих нулей.
 * Знак «+» оставляем: «120+80» складывается при сохранении.
 */
function formatAmountRaw(raw) {
  let s = String(raw || '').replace(/\./g, ',').replace(/[^\d,+]/g, '');
  s = s.replace(/^\++/, '').replace(/\+{2,}/g, '+');
  return s.split('+').map(t => {
    const ci = t.indexOf(',');
    let int = ci >= 0 ? t.slice(0, ci) : t;
    let dec = ci >= 0 ? t.slice(ci + 1).replace(/,/g, '') : '';
    int = int.replace(/^0+(?=\d)/, '').slice(0, 12);
    if (ci >= 0 && !int) int = '0';
    dec = dec.slice(0, 2);
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEP) + (ci >= 0 ? ',' + dec : '');
  }).join('+');
}
const isAmountChar = ch => /[\d,.+]/.test(ch);
const countAmountChars = s => Array.from(s).filter(isAmountChar).length;

/** Записывает отформатированную сумму и ставит курсор после того же числа значащих символов. */
function applyAmount(el, raw, caret) {
  const before = countAmountChars(raw.slice(0, caret));
  const text = formatAmountRaw(raw);
  el.value = text;
  let pos = 0;
  let n = 0;
  while (pos < text.length && n < before) {
    if (isAmountChar(text[pos])) n++;
    pos++;
  }
  if (document.activeElement === el) el.setSelectionRange(pos, pos);
  layoutAmount();
}

/** Ширина поля точно по тексту; если сумма длинная — шрифт уменьшается, чтобы число целиком помещалось. */
function layoutAmount() {
  const el = $('#tx-amount');
  const m = $('#amount-measure');
  if (!el || !m) return;
  const row = el.parentElement;
  const pick = row.querySelector('.cur-pick');
  const avail = Math.max(60, row.clientWidth - (pick ? pick.offsetWidth : 0) - 12 - 6);
  m.textContent = el.value || el.placeholder;
  m.style.fontSize = AMOUNT_FONT + 'px';
  let w = m.offsetWidth;
  let size = AMOUNT_FONT;
  if (w > avail) {
    size = Math.max(AMOUNT_FONT_MIN, Math.floor(AMOUNT_FONT * avail / w));
    m.style.fontSize = size + 'px';
    w = m.offsetWidth;
  }
  el.style.fontSize = size + 'px';
  el.style.width = Math.min(avail, Math.ceil(w) + 4) + 'px';
}

function bindAmountInput(el) {
  el.addEventListener('input', () => {
    applyAmount(el, el.value, el.selectionStart == null ? el.value.length : el.selectionStart);
    updateConversion();
  });
  // Backspace/Delete рядом с пробелом между разрядами удаляет соседнюю цифру, а не «застревает» на пробеле.
  el.addEventListener('beforeinput', e => {
    if (e.inputType !== 'deleteContentBackward' && e.inputType !== 'deleteContentForward') return;
    const a = el.selectionStart;
    if (a == null || a !== el.selectionEnd) return;
    const back = e.inputType === 'deleteContentBackward';
    const sepAt = back ? a - 1 : a;
    if (el.value[sepAt] !== GROUP_SEP) return;
    e.preventDefault();
    const delAt = back ? sepAt - 1 : sepAt + 1;
    if (delAt < 0 || delAt >= el.value.length) return;
    applyAmount(el, el.value.slice(0, delAt) + el.value.slice(delAt + 1), delAt);
    updateConversion();
  });
}

/** Подпись «≈ сумма в основной валюте» под суммой; при наличии сети уточняет курс по дате. */
let convToken = 0;
function updateConversion() {
  const box = $('#tx-conv');
  if (!box || !FORM) return;
  const my = ++convToken; // поздний ответ сети для прежней валюты/даты будет проигнорирован
  const cur = FORM.currency;
  const b = base();
  const raw = $('#tx-amount').value;
  const amount = parseAmount(raw);
  // «120+80» → подсказка «= 200»
  const sumNote = raw.includes('+') && amount > 0 ? `= ${fmtNum(amount)} ${sym(cur)}` : '';
  if (cur === b) { box.textContent = sumNote; box.className = 'conv'; FORM.rate = 1; FORM.rateApprox = false; return; }
  const date = $('#tx-date').value || todayStr();
  const paint = (rate, exact, rateDate) => {
    FORM.rate = rate;
    FORM.rateApprox = !exact;
    const head = (sumNote ? sumNote + ' · ' : '') + (amount > 0 ? `≈ ${fmtMoney(amount * rate)} · ` : '');
    box.textContent = `${head}1 ${sym(cur)} = ${nfRate.format(rate)} ${sym(b)}` +
      (exact ? ` на ${shortDate(rateDate)}` : ' · примерный курс, уточнится при подключении к интернету');
    box.className = 'conv' + (exact ? '' : ' approx');
  };
  // У сохранённой операции с той же валютой и датой оставляем её курс (не заменяем примерным).
  const o = FORM.orig;
  if (o && o.currency === cur && o.date === date && o.rate > 0 && !RATE_FIX.includes(FORM.id)) {
    paint(o.rate, true, date);
    return;
  }
  const q = quickRate(cur, date);
  paint(q.rate, q.exact, q.date);
  if (!q.exact && navigator.onLine) {
    exactTable(date).then(tbl => {
      if (!tbl || my !== convToken || !FORM || FORM.kind !== 'tx') return;
      paint(round6(tbl[b] / tbl[cur]), true, date);
    }).catch(() => {});
  }
}

/** draft — несохранённые значения формы (после создания категории из формы). */
function openTxForm(tx, draft) {
  const isNew = !tx;
  FORM = {
    kind: 'tx',
    id: tx ? tx.id : null,
    type: tx ? tx.type : (UI.lastType || 'expense'),
    categoryId: tx ? tx.categoryId : '',
    currency: tx ? txCur(tx) : (S.settings.lastCurrency && CUR[S.settings.lastCurrency] ? S.settings.lastCurrency : base()),
    orig: tx ? { currency: txCur(tx), date: tx.date, rate: tx.rate } : null,
    q: ''
  };
  const v = {
    amount: tx ? String(tx.amount).replace('.', ',') : '',
    date: tx ? tx.date : todayStr(),
    comment: tx ? tx.comment : ''
  };
  if (draft) {
    Object.assign(FORM, { type: draft.type, categoryId: draft.categoryId, currency: draft.currency });
    Object.assign(v, { amount: draft.amount, date: draft.date, comment: draft.comment });
  }
  openModal(isNew ? 'Новая операция' : 'Операция', `
    <div class="seg wide" id="tx-type">
      <button type="button" data-act="tx-type" data-type="expense" class="${FORM.type === 'expense' ? 'on' : ''}">Расход</button>
      <button type="button" data-act="tx-type" data-type="income" class="${FORM.type === 'income' ? 'on' : ''}">Доход</button>
    </div>
    <div class="amount-row">
      <input id="tx-amount" class="amount-input" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off"
        autocorrect="off" spellcheck="false" placeholder="0" value="${esc(formatAmountRaw(v.amount))}" aria-label="Сумма">
      ${curPick('tx-cur', FORM.currency)}
      <span id="amount-measure" class="amount-measure" aria-hidden="true"></span>
    </div>
    <div class="conv" id="tx-conv"></div>
    <div class="field"><input id="cat-q" type="search" placeholder="Поиск категории" autocomplete="off" aria-label="Поиск категории"></div>
    <div class="chips chips-wrap" id="tx-cats">${catChipsHTML()}</div>
    <label class="field-label" for="tx-date">Дата</label>
    <div class="field"><input id="tx-date" type="date" value="${esc(v.date)}"></div>
    <label class="field-label" for="tx-comment">Комментарий</label>
    <div class="field"><input id="tx-comment" maxlength="200" autocomplete="off" value="${esc(v.comment)}" placeholder="Необязательно"></div>
    <div class="error-text" id="tx-err"></div>
    <div class="form-actions">
      <button type="button" class="btn primary block" data-act="tx-save">Сохранить</button>
      ${isNew ? '' : '<button type="button" class="btn danger block" data-act="tx-delete">Удалить операцию</button>'}
    </div>`);
  const amountEl = $('#tx-amount');
  bindAmountInput(amountEl);
  $('#tx-date').addEventListener('change', updateConversion);
  $('#tx-cur').addEventListener('change', e => {
    FORM.currency = e.target.value;
    e.target.closest('.cur-pick').querySelector('.cp-label').textContent = curLabel(FORM.currency);
    layoutAmount();
    updateConversion();
  });
  $('#cat-q').addEventListener('input', e => { FORM.q = e.target.value; renderChips(); });
  layoutAmount();
  updateConversion();
  // Фокус сразу, в том же нажатии на «+»: иначе iPhone не открывает клавиатуру.
  if (isNew && !draft) {
    amountEl.focus({ preventScroll: true });
    requestAnimationFrame(layoutAmount);
  }
}

function readTxDraft() {
  return {
    id: FORM.id, type: FORM.type, categoryId: FORM.categoryId, currency: FORM.currency,
    amount: $('#tx-amount').value, date: $('#tx-date').value, comment: $('#tx-comment').value
  };
}

function saveTxForm() {
  const err = $('#tx-err');
  const amount = parseAmount($('#tx-amount').value);
  const date = $('#tx-date').value;
  if (!(amount > 0)) { err.textContent = 'Введите сумму больше нуля (можно так: 120+80)'; return; }
  if (!FORM.categoryId) { err.textContent = 'Выберите категорию'; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { err.textContent = 'Укажите дату'; return; }
  const cur = FORM.currency;
  let rate = 1;
  let rateApprox = false;
  if (cur !== base()) {
    if (FORM.rate > 0) { rate = FORM.rate; rateApprox = FORM.rateApprox; } else {
      const q = quickRate(cur, date);
      rate = q.rate;
      rateApprox = !q.exact;
    }
  }
  upsertTx({
    id: FORM.id, type: FORM.type, amount, currency: cur, rate, rateApprox,
    categoryId: FORM.categoryId, date, comment: $('#tx-comment').value.trim()
  });
  UI.lastType = FORM.type;
  S.settings.lastCurrency = cur;
  rememberCurrency(cur);
  if (ymOf(date) !== UI.month && !FORM.id) UI.month = ymOf(date);
  closeModal();
  toast('Сохранено');
  renderAll();
  if (rateApprox && navigator.onLine) refineRates().then(renderAll).catch(() => {});
}

/* ===== Экран «Настройки» ===== */

function renderSettings() {
  const view = $('#view-settings');
  if (!view.querySelector('#st-url')) {
    view.innerHTML = `
      <div class="card">
        <h3>Google Таблица</h3>
        <p class="sub">Операции сохраняются на телефоне и отправляются в таблицу, когда появляется интернет.</p>
        <label class="field-label" for="st-url">Адрес веб-приложения</label>
        <div class="field"><input id="st-url" type="url" inputmode="url" autocomplete="off" spellcheck="false"
          placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.settings.url)}"></div>
        <label class="field-label" for="st-token">Ключ доступа</label>
        <div class="field"><input id="st-token" type="password" autocomplete="off" spellcheck="false" value="${esc(S.settings.token)}"></div>
        <div class="form-actions"><button type="button" class="btn primary block" data-act="save-settings">Сохранить и синхронизировать</button></div>
        <div class="sync-info" id="sync-info"></div>
      </div>
      <div class="card">
        <h3>Валюты</h3>
        <label class="field-label" for="st-base">Основная валюта</label>
        <div class="field"><select id="st-base">${currencyOptions(base())}</select>${icon('chevron-down', 'chev')}</div>
        <p class="sub" style="margin:10px 4px 0">В ней считаются итоги и отчёты. Операцию можно ввести в любой валюте:
          она пересчитается по курсу на дату операции. На всех телефонах выберите одну и ту же основную валюту.</p>
        <div class="sync-info" id="rates-info"></div>
        <div class="form-actions"><button type="button" class="btn block" data-act="refresh-rates">Обновить курсы</button></div>
      </div>
      <div class="card">
        <h3>Данные</h3>
        <p class="sub" id="st-count"></p>
        <div class="form-actions" style="margin-top:14px"><button type="button" class="btn block" data-act="export-csv">Скачать операции (CSV)</button></div>
      </div>
      <div class="card">
        <h3>Установка на телефон</h3>
        <ul class="steps">
          <li>Android, Chrome: меню ⋮ → «Добавить на главный экран».</li>
          <li>iPhone, Safari: «Поделиться» → «На экран Домой».</li>
          <li>После установки приложение открывается и работает без интернета.</li>
        </ul>
      </div>
      <p class="version">Версия ${APP_VERSION} · курсы: открытые данные currency-api</p>`;
    $('#st-base').addEventListener('change', async e => {
      const sel = e.target;
      const ok = await changeBase(sel.value);
      if (!ok) sel.value = base();
      else toast('Основная валюта: ' + CUR[base()].name);
      updateSyncInfo();
    });
  }
  updateSyncInfo();
}

function updateSyncInfo() {
  const kv = (k, v, cls = '') => `<div class="kv ${cls}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  const box = $('#sync-info');
  if (box) {
    box.innerHTML =
      kv('Последняя синхронизация', S.meta.lastSync ? timeLabel(S.meta.lastSync) : 'ещё не было') +
      kv('Ждут отправки', String(dirtyCount())) +
      kv('Интернет', navigator.onLine ? 'есть' : 'нет') +
      (UI.syncing ? kv('Сейчас', 'идёт синхронизация…') : '') +
      (S.meta.lastError ? kv('Ошибка', S.meta.lastError, 'err') : '');
  }
  const rb = $('#rates-info');
  if (rb) {
    const t = approxTable(todayStr());
    const b = base();
    const show = ['USD', 'EUR', 'RUB', 'GEL'].filter(c => c !== b).slice(0, 3);
    rb.innerHTML = kv('Курсы загружены', RATES.latest ? timeLabel(RATES.latest.at) : 'ещё нет (встроенные)') +
      show.map(c => kv(`1 ${c}`, `${nfRate.format(t.r[b] / t.r[c])} ${sym(b)}`)).join('') +
      (RATE_FIX.length ? kv('Ждут точного курса', String(RATE_FIX.length)) : '');
  }
  const cnt = $('#st-count');
  if (cnt) cnt.textContent = `На устройстве: операций ${liveTx().length}, категорий ${S.cats.length}.`;
}

function exportCSV() {
  const cm = catMap();
  const cell = v => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const dec = v => String(Math.round(v * 100) / 100).replace('.', ',');
  const rows = [['Дата', 'Тип', 'Сумма', 'Валюта', 'Курс', `Сумма, ${base()}`, 'Категория', 'Комментарий']];
  liveTx().slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).forEach(t => {
    const [y, m, d] = t.date.split('-');
    rows.push([`${d}.${m}.${y}`, t.type === 'income' ? 'Доход' : 'Расход', dec(t.amount), txCur(t),
      String(txCur(t) === base() ? 1 : t.rate).replace('.', ','), dec(baseAmt(t)),
      (cm[t.categoryId] || UNKNOWN_CAT).name, t.comment || '']);
  });
  const csv = '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `finance-${todayStr()}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ===== Модальное окно ===== */

function openModal(title, html) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal-body').scrollTop = 0;
  $('#modal').hidden = false;
  if (!UI.modalOpen) {
    UI.modalOpen = true;
    history.pushState({ modal: true }, '');
  }
}
function closeModal(fromPopstate) {
  if (!UI.modalOpen) return;
  UI.modalOpen = false;
  FORM = null;
  $('#modal').hidden = true;
  $('#modal-body').innerHTML = '';
  if (!fromPopstate && history.state && history.state.modal) history.back();
  if (typeof pendingReload !== 'undefined' && pendingReload) setTimeout(() => location.reload(), 300);
}
window.addEventListener('popstate', () => { if (UI.modalOpen) closeModal(true); });
// Иначе браузер при закрытии окна (history.back) сам прокручивает страницу на старое место.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* ===== Действия (делегирование кликов) ===== */

const ACTIONS = {
  nav(d) {
    UI.view = d.view;
    if (d.view === 'settings') $('#view-settings').innerHTML = '';
    renderAll();
    window.scrollTo(0, 0);
  },
  prev() { UI.month = addMonths(UI.month, UI.view === 'reports' && UI.rMode === 'year' ? -12 : -1); renderAll(); },
  next() { UI.month = addMonths(UI.month, UI.view === 'reports' && UI.rMode === 'year' ? 12 : 1); renderAll(); },
  badge() {
    if (!S.settings.url) ACTIONS.nav({ view: 'settings' });
    else sync(true);
  },
  'new-tx'() { openTxForm(null); },
  'open-tx'(d) {
    const t = S.tx.find(x => x.id === d.id);
    if (t) openTxForm(t);
  },
  'tx-type'(d) {
    FORM.type = d.type;
    const c = catMap()[FORM.categoryId];
    if (!c || c.type !== FORM.type) FORM.categoryId = '';
    $$('#tx-type button').forEach(b => b.classList.toggle('on', b.dataset.type === d.type));
    renderChips();
  },
  'tx-cat'(d) {
    FORM.categoryId = d.id;
    $$('#tx-cats .chip').forEach(b => b.classList.toggle('on', b.dataset.id === d.id));
    $('#tx-err').textContent = '';
  },
  'tx-quickcat'() {
    const name = (FORM.q || '').trim();
    if (!name) return;
    const exists = S.cats.find(c => c.type === FORM.type && norm(c.name) === norm(name));
    if (exists) {
      if (exists.hidden) upsertCat({ id: exists.id, hidden: false });
      FORM.categoryId = exists.id;
    } else {
      FORM.categoryId = upsertCat({ name, type: FORM.type });
      toast(`Категория «${name}» создана`);
    }
    FORM.q = '';
    $('#cat-q').value = '';
    renderChips();
    $('#tx-err').textContent = '';
  },
  'tx-newcat'() {
    const draft = readTxDraft();
    const tx = draft.id ? S.tx.find(x => x.id === draft.id) : null;
    openCatForm(null, {
      type: draft.type,
      onSaved: id => openTxForm(tx, { ...draft, categoryId: id }),
      onCancel: () => openTxForm(tx, draft)
    });
  },
  'tx-save'() { saveTxForm(); },
  'tx-delete'() {
    if (!confirm('Удалить эту операцию?')) return;
    deleteTx(FORM.id);
    closeModal();
    toast('Операция удалена');
    renderAll();
  },
  'close-modal'() {
    if (FORM && FORM.onCancel) FORM.onCancel();
    else closeModal();
  },
  rmode(d) { UI.rMode = d.mode; renderAll(); },
  rkind(d) { UI.rKind = d.kind; renderAll(); },
  drill(d) { openDrill(d.id); },
  ckind(d) { UI.catKind = d.kind; renderAll(); },
  'new-cat'() { openCatForm(null, { name: UI.catQ.trim() }); },
  'edit-cat'(d) {
    const c = S.cats.find(x => x.id === d.id);
    if (c) openCatForm(c);
  },
  'cf-type'(d) {
    FORM.type = d.type;
    $$('#cf-type button').forEach(b => b.classList.toggle('on', b.dataset.type === d.type));
  },
  'cf-save'() { saveCatForm(); },
  'save-settings'() {
    const url = $('#st-url').value.trim();
    const token = $('#st-token').value.trim();
    if (url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
      toast('Адрес должен начинаться с https://script.google.com/');
      return;
    }
    const changed = url !== S.settings.url;
    Object.assign(S.settings, { url, token });
    saveSettings();
    if (changed) { S.meta.lastError = ''; saveMeta(); }
    if (url && token) sync(true);
    else { toast('Сохранено'); renderBadge(); updateSyncInfo(); }
  },
  async 'refresh-rates'() {
    if (!navigator.onLine) { toast('Нет интернета'); return; }
    const ok = await refreshLatest(true);
    await refineRates();
    toast(ok ? 'Курсы обновлены' : 'Не удалось загрузить курсы');
    updateSyncInfo();
  },
  'export-csv'() { exportCSV(); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && UI.modalOpen) ACTIONS['close-modal']();
  if (e.key === 'Enter' && FORM && e.target.tagName === 'INPUT') {
    if (e.target.id === 'tx-amount' && !FORM.categoryId) {
      // «Готово» на клавиатуре: спрятать клавиатуру и дать выбрать категорию.
      e.preventDefault();
      e.target.blur();
      return;
    }
    if (e.target.id === 'cat-q') {
      // Enter в поиске: выбрать единственную найденную категорию или создать новую.
      e.preventDefault();
      const chips = $$('#tx-cats .chip[data-act="tx-cat"]');
      if (chips.length === 1) chips[0].click();
      else if (!chips.length && FORM.q.trim()) ACTIONS['tx-quickcat']();
      return;
    }
    if (FORM.kind === 'tx') saveTxForm();
    if (FORM.kind === 'cat') saveCatForm();
  }
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') ACTIONS['close-modal'](); });

/* ===== Запуск ===== */

// Иконки в разметке (<i data-icon="…">) → линейные SVG.
$$('i[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon); });
saveSettings();

/** Обновить курсы и уточнить примерные (работает и без подключённой таблицы). */
async function ratesTick() {
  if (!navigator.onLine) return;
  const before = RATE_FIX.length;
  await refreshLatest().catch(() => false);
  await refineRates().catch(() => {});
  if (before !== RATE_FIX.length && !UI.modalOpen) refreshAfterSync();
}

window.addEventListener('online', () => { renderBadge(); updateSyncInfo(); ratesTick().then(() => sync(false)); });
window.addEventListener('offline', () => { renderBadge(); updateSyncInfo(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - S.meta.lastSync > 30000) sync(false);
});
setInterval(() => {
  if (RATE_FIX.length) ratesTick();
  if (dirtyCount()) sync(false);
}, 60000);
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (UI.view === 'reports') renderReports();
    if (UI.modalOpen) layoutAmount();
  }, 200);
});

// Обновления: новая версия ставится в фоне; когда она готова, приложение перезагружается само
// (если открыта форма — после её закрытия, чтобы не потерять введённое).
let swReg = null;
let pendingReload = false;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || pendingReload) return;
    pendingReload = true;
    if (!UI.modalOpen) location.reload();
    else toast('Загружена новая версия, она откроется после закрытия формы');
  });
  navigator.serviceWorker.register('sw.js').then(reg => { swReg = reg; reg.update().catch(() => {}); }).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && swReg) swReg.update().catch(() => {});
  });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

renderAll();
ratesTick().then(() => sync(false));
