'use strict';

/* =====================================================================
   Мои финансы — офлайн-приложение учёта личных финансов.
   Данные хранятся на устройстве (localStorage) и синхронизируются
   с Google Таблицей через веб-приложение Apps Script, когда есть интернет.
   Иконки: icons.js (функция icon()).
   ===================================================================== */

const APP_VERSION = '0.2.0';
const SEED_TIME = '2026-01-01T00:00:00.000Z';

// Базовые категории. ID совпадают с листом «Категории» в Google Таблице.
const DEFAULT_CATEGORIES = (() => {
  const list = [
    ['exp_food', 'Продукты', 'cart'], ['exp_cafe', 'Кафе и рестораны', 'utensils'],
    ['exp_transport', 'Транспорт', 'bus'], ['exp_car', 'Автомобиль', 'car'],
    ['exp_home', 'Жильё и ЖКХ', 'home'], ['exp_phone', 'Связь и интернет', 'phone'],
    ['exp_health', 'Здоровье и аптека', 'pill'], ['exp_clothes', 'Одежда и обувь', 'shirt'],
    ['exp_beauty', 'Красота и уход', 'sparkles'], ['exp_fun', 'Развлечения', 'film'],
    ['exp_subs', 'Подписки', 'tv'], ['exp_edu', 'Образование', 'book'],
    ['exp_kids', 'Дети', 'balloon'], ['exp_pets', 'Питомцы', 'paw'],
    ['exp_gifts', 'Подарки', 'gift'], ['exp_travel', 'Путешествия', 'plane'],
    ['exp_sport', 'Спорт', 'dumbbell'], ['exp_house', 'Дом и ремонт', 'roller'],
    ['exp_tech', 'Техника', 'laptop'], ['exp_credit', 'Кредиты и долги', 'card'],
    ['exp_taxes', 'Налоги и штрафы', 'receipt'], ['exp_charity', 'Благотворительность', 'heart'],
    ['exp_other', 'Прочие расходы', 'box'],
    ['inc_salary', 'Зарплата', 'briefcase'], ['inc_side', 'Подработка', 'wrench'],
    ['inc_bonus', 'Премии', 'star'], ['inc_business', 'Бизнес', 'building'],
    ['inc_interest', 'Проценты и кешбэк', 'percent'], ['inc_invest', 'Инвестиции', 'trend'],
    ['inc_gifts', 'Подарки', 'gift'], ['inc_debt', 'Возврат долгов', 'repeat'],
    ['inc_sale', 'Продажа вещей', 'tag'], ['inc_social', 'Пенсия и пособия', 'landmark'],
    ['inc_other', 'Прочие доходы', 'coins']
  ];
  const counters = { expense: 0, income: 0 };
  return list.map(([id, name, ic]) => {
    const type = id.startsWith('inc_') ? 'income' : 'expense';
    return { id, name, type, icon: ic, order: ++counters[type], hidden: false, updatedAt: SEED_TIME, srv: false, dirty: false };
  });
})();

const CURRENCIES = [['₽', 'Российский рубль, ₽'], ['$', 'Доллар США, $'], ['€', 'Евро, €'], ['₾', 'Грузинский лари, ₾'],
  ['₸', 'Казахстанский тенге, ₸'], ['Br', 'Белорусский рубль, Br'], ['₴', 'Гривна, ₴'], ['֏', 'Армянский драм, ֏']];

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

const KEYS = { tx: 'fin.tx.v1', cats: 'fin.cats.v1', settings: 'fin.settings.v1', meta: 'fin.meta.v1' };

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
  settings: Object.assign({ url: '', token: '', currency: '₽' }, readLS(KEYS.settings, {})),
  meta: Object.assign({ lastSync: 0, lastError: '' }, readLS(KEYS.meta, {}))
};
const saveTx = () => writeLS(KEYS.tx, S.tx);
const saveCats = () => writeLS(KEYS.cats, S.cats);
const saveSettings = () => writeLS(KEYS.settings, S.settings);
const saveMeta = () => writeLS(KEYS.meta, S.meta);

const UI = {
  view: 'home',
  month: ymOf(todayStr()),   // выбранный месяц (общий для операций и отчётов)
  rMode: 'month',            // отчёт: month | year
  rKind: 'expense',          // структура: expense | income
  catKind: 'expense',        // экран категорий
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
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
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
const cur = () => S.settings.currency || '₽';
function fmtNum(v) {
  const a = Math.abs(v);
  return (Math.abs(a - Math.round(a)) < 0.005 ? nf0 : nf2).format(a);
}
function fmtMoney(v) { return (v < 0 ? '−' : '') + fmtNum(v) + ' ' + cur(); }
function timeLabel(ts) {
  const d = new Date(ts);
  const sameDay = todayStr() === `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameDay ? hm : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${hm}`;
}
function parseAmount(s) {
  s = String(s || '').replace(/\s/g, '').replace(/,/g, '.');
  if (!/^\d*\.?\d+(\+\d*\.?\d+)*$/.test(s)) return NaN;
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

/* ===== Данные ===== */

const liveTx = () => S.tx.filter(t => !t.deleted);
const catMap = () => Object.fromEntries(S.cats.map(c => [c.id, c]));
const UNKNOWN_CAT = { name: 'Без категории', icon: 'question' };
const catIcon = c => icon(iconKey(c && c.icon));
const sumType = (list, type) => list.reduce((a, t) => a + (t.type === type ? t.amount : 0), 0);
const dirtyCount = () => S.tx.filter(t => t.dirty).length + S.cats.filter(c => c.dirty).length;

function upsertTx(f) {
  const now = nowIso();
  const i = S.tx.findIndex(t => t.id === f.id);
  const rec = {
    date: f.date, type: f.type, amount: f.amount, categoryId: f.categoryId,
    comment: f.comment, updatedAt: now, dirty: true
  };
  if (i >= 0) S.tx[i] = { ...S.tx[i], ...rec };
  else S.tx.push({ id: uid(), createdAt: now, srv: false, deleted: false, ...rec });
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
    S.cats.push({ id: 'c_' + uid().slice(0, 8), order, hidden: false, srv: false, ...c, updatedAt: now, dirty: true });
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
  else renderAll();
}

function monthSwitch(label) {
  return `<div class="month-switch">
    <button type="button" class="icon-btn soft" data-act="prev" aria-label="Назад">${icon('chevron-left')}</button>
    <span class="label">${esc(label)}</span>
    <button type="button" class="icon-btn soft" data-act="next" aria-label="Вперёд">${icon('chevron-right')}</button>
  </div>`;
}

function emptyHTML(ic, title, sub, small) {
  return `<div class="empty${small ? ' small' : ''}"><span class="ic-circle big">${icon(ic)}</span>
    <div class="empty-title">${esc(title)}</div>${sub ? `<div class="empty-sub">${esc(sub)}</div>` : ''}</div>`;
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
      return `<button type="button" class="tx" data-act="open-tx" data-id="${esc(t.id)}">
        <span class="ic-circle">${catIcon(c)}</span>
        <span class="tx-main"><span class="tx-cat">${esc(c.name)}</span>${t.comment ? `<span class="tx-com">${esc(t.comment)}</span>` : ''}</span>
        <span class="tx-amt ${t.type}">${sign}${esc(fmtNum(t.amount))}&nbsp;${esc(cur())}</span>
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
        <div class="mini"><span class="mini-ic in">${icon('arrow-in')}</span>
          <div><div class="mini-label">Доходы</div><div class="mini-value">${esc(fmtMoney(inc))}</div></div></div>
        <div class="mini"><span class="mini-ic">${icon('arrow-out')}</span>
          <div><div class="mini-label">Расходы</div><div class="mini-value">${esc(fmtMoney(exp))}</div></div></div>
      </div>
    </section>
    ${list.length ? txListHTML(list) : emptyHTML('list', 'Операций пока нет', 'Нажмите «+», чтобы добавить первую')}`;
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

function renderReports() {
  const { isYear, y, p, label } = reportPeriod();
  const m = Number(UI.month.slice(5, 7));
  const pp = isYear ? yearPeriod(y - 1) : monthPeriod(addMonths(UI.month, -1));
  const prevLabel = isYear ? String(y - 1) : MONTHS_DAT[(m + 10) % 12];
  const all = liveTx();
  const curList = all.filter(t => inPeriod(t, p));
  const prevList = all.filter(t => inPeriod(t, pp));
  const inc = sumType(curList, 'income');
  const exp = sumType(curList, 'expense');

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
  curList.filter(t => t.type === kind).forEach(t => { byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount; });
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
      <span class="ic-circle">${catIcon(it.c)}</span>
      <span class="lg-main"><span class="lg-name">${esc(it.c.name)}</span>
        <span class="lg-pct">${pct < 1 ? 'меньше 1' : Math.round(pct)}%</span></span>
      <span class="lg-val">${esc(fmtMoney(it.v))}</span>
    </button>`;
  }).join('');

  // Помесячная динамика
  const months = isYear
    ? Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`)
    : Array.from({ length: 6 }, (_, i) => addMonths(UI.month, i - 5));
  const byMonth = {};
  all.forEach(t => {
    const k = ymOf(t.date);
    const o = byMonth[k] || (byMonth[k] = { income: 0, expense: 0 });
    o[t.type] += t.amount;
  });
  const incV = months.map(k => (byMonth[k] || {}).income || 0);
  const expV = months.map(k => (byMonth[k] || {}).expense || 0);
  const tableRows = months.map((k, i) => `<tr><td>${esc(monthLabel(k))}</td><td>${esc(fmtNum(incV[i]))}</td>
    <td>${esc(fmtNum(expV[i]))}</td><td>${esc((incV[i] - expV[i] < 0 ? '−' : '') + fmtNum(incV[i] - expV[i]))}</td></tr>`).join('');

  $('#view-reports').innerHTML = `
    <div class="seg wide" style="margin-bottom:12px">
      <button type="button" data-act="rmode" data-mode="month" class="${isYear ? '' : 'on'}">Месяц</button>
      <button type="button" data-act="rmode" data-mode="year" class="${isYear ? 'on' : ''}">Год</button>
    </div>
    ${monthSwitch(label)}
    <div class="kpis">
      ${kpi('Доходы', fmtMoney(inc), deltaHTML(inc, sumType(prevList, 'income'), true, prevLabel), 'income')}
      ${kpi('Расходы', fmtMoney(exp), deltaHTML(exp, sumType(prevList, 'expense'), false, prevLabel), 'expense')}
      ${kpi('Баланс', fmtMoney(inc - exp), `<div class="k-delta">${!inc ? '&nbsp;'
        : inc >= exp ? `Осталось ${Math.round((inc - exp) / inc * 100)}% дохода` : 'Расходы больше доходов'}</div>`)}
      ${kpi(isYear ? 'Расход в месяц' : 'Расход в день', fmtMoney(avg), '<div class="k-delta">в среднем</div>')}
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
      : emptyHTML('pie', 'Нет данных за этот период', '', true)}
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

  if (items.length) {
    bindDonut($('#donut'), segs, total, {
      label: kind === 'expense' ? 'Расходы' : 'Доходы',
      value: fmtMoney(total),
      sub: label
    });
  }

  columnChart($('#chart-months'), {
    title: 'Доходы и расходы по месяцам',
    labels: months.map(k => MONTHS_SHORT[Number(k.slice(5, 7)) - 1]),
    tipLabels: months.map(monthLabel),
    series: [{ name: 'Доходы', cls: 'income', values: incV }, { name: 'Расходы', cls: 'expense', values: expV }],
    showLabel: (i, band) => band >= 28 || i % 2 === 0
  });

  if (!isYear) {
    const daily = Array(p.days).fill(0);
    curList.forEach(t => { if (t.type === 'expense') daily[Number(t.date.slice(8, 10)) - 1] += t.amount; });
    columnChart($('#chart-days'), {
      title: 'Расходы по дням',
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

function bindDonut(wrap, segs, total, def) {
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
      val.textContent = fmtMoney(s.value);
      const pct = s.value / total * 100;
      sub.textContent = `${pct < 1 ? '<1' : Math.round(pct)}% от суммы`;
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
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
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
  if (maxV <= 0) { box.innerHTML = emptyHTML('trend', 'Нет данных за этот период', '', true); return; }
  const ticks = niceTicks(maxV);
  const top = ticks[ticks.length - 1];
  const compact = top >= 10000;
  const fmtAxis = v => (compact ? nfc : nf0).format(v);
  // Левое поле под самую длинную подпись оси, чтобы «200 тыс.» не обрезалось.
  const longest = Math.max(...ticks.map(v => fmtAxis(v).length));
  const m = { l: Math.ceil(longest * 6.6) + 12, r: 4, t: 12, b: 24 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const band = pw / n;
  const gap = 2;
  const bw = Math.max(2, Math.min(18, (band * 0.62 - gap * (k - 1)) / k));
  const gw = bw * k + gap * (k - 1);
  const base = m.t + ph;
  const parts = [`<rect class="hl" x="0" y="${m.t}" width="${band}" height="${ph}" rx="8" visibility="hidden"/>`];
  ticks.forEach(v => {
    const yy = Math.round(base - v / top * ph) + 0.5;
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
      parts.push(`<path class="bar ${s.cls}" d="${barPath(x, base - h, bw, h, Math.min(4, bw / 2, h))}"/>`);
    });
    if (cfg.showLabel(i, band)) {
      parts.push(`<text class="xlab" x="${m.l + band * i + band / 2}" y="${H - 6}" text-anchor="middle">${esc(cfg.labels[i])}</text>`);
    }
  }
  parts.push(`<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${base + 0.5}" y2="${base + 0.5}"/>`);
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
      v.textContent = fmtMoney(s.values[i]);
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
  const c = catMap()[catId] || UNKNOWN_CAT;
  const list = liveTx().filter(t => t.categoryId === catId && t.type === UI.rKind && inPeriod(t, p));
  const total = list.reduce((a, t) => a + t.amount, 0);
  openModal(c.name, `
    <p class="sub" style="margin:0 4px 16px;text-align:center">${esc(label)} · ${esc(fmtMoney(total))} · операций: ${list.length}</p>
    ${txListHTML(list)}`);
}

/* ===== Экран «Категории» ===== */

function renderCats() {
  const kind = UI.catKind;
  const counts = {};
  liveTx().forEach(t => { counts[t.categoryId] = (counts[t.categoryId] || 0) + 1; });
  const list = S.cats.filter(c => c.type === kind)
    .sort((a, b) => (a.hidden - b.hidden) || (a.order - b.order) || a.name.localeCompare(b.name, 'ru'));
  $('#view-cats').innerHTML = `
    <div class="toolbar">
      <div class="seg">
        <button type="button" data-act="ckind" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">Расходы</button>
        <button type="button" data-act="ckind" data-kind="income" class="${kind === 'income' ? 'on' : ''}">Доходы</button>
      </div>
      <button type="button" class="btn primary small" data-act="new-cat">${icon('plus')}Новая</button>
    </div>
    <div class="card list-card">
      ${list.map(c => `<button type="button" class="cat-row ${c.hidden ? 'hidden-cat' : ''}" data-act="edit-cat" data-id="${esc(c.id)}">
        <span class="ic-circle">${catIcon(c)}</span>
        <span class="name">${esc(c.name)}</span>
        ${c.hidden ? '<span class="tag">скрыта</span>' : ''}
        ${c.dirty ? '<span class="dot" title="Ещё не отправлено в таблицу"></span>' : ''}
        <span class="count">${counts[c.id] || 0}</span>
        ${icon('chevron-right', 'chev')}
      </button>`).join('')}
    </div>
    <p class="hint">Число справа: сколько операций в категории. Скрытые категории не предлагаются при вводе, но остаются в отчётах.</p>`;
}

function openCatForm(cat, opts = {}) {
  const isNew = !cat;
  FORM = {
    kind: 'cat',
    id: cat ? cat.id : null,
    type: cat ? cat.type : (opts.type || UI.catKind),
    icon: cat ? iconKey(cat.icon) : 'tag',
    onSaved: opts.onSaved || null,
    onCancel: opts.onCancel || null
  };
  const used = cat ? liveTx().filter(t => t.categoryId === cat.id).length : 0;
  openModal(isNew ? 'Новая категория' : 'Категория', `
    <label class="field-label" for="cf-name" style="margin-top:4px">Название</label>
    <div class="field">${icon('tag')}<input id="cf-name" maxlength="40" autocomplete="off" value="${esc(cat ? cat.name : '')}" placeholder="Например, Кофе"></div>
    ${isNew ? `<div class="seg wide" id="cf-type" style="margin-top:12px">
      <button type="button" data-act="cf-type" data-type="expense" class="${FORM.type === 'expense' ? 'on' : ''}">Расход</button>
      <button type="button" data-act="cf-type" data-type="income" class="${FORM.type === 'income' ? 'on' : ''}">Доход</button>
    </div>` : `<p class="sub" style="margin:10px 4px 0">${cat.type === 'income' ? 'Категория доходов' : 'Категория расходов'} · операций: ${used}</p>`}
    <div class="field-label">Иконка</div>
    <div class="icon-grid" id="cf-icons">
      ${CATEGORY_ICON_KEYS.map(k => `<button type="button" data-act="cf-icon" data-icon="${k}" class="${k === FORM.icon ? 'on' : ''}" aria-label="${k}">${icon(k)}</button>`).join('')}
    </div>
    ${isNew ? '' : `<label class="switch-row"><span>Скрыть категорию</span><input type="checkbox" class="switch" id="cf-hidden" ${cat.hidden ? 'checked' : ''}></label>`}
    <div class="error-text" id="cf-err"></div>
    <div class="form-actions"><button type="button" class="btn primary block" data-act="cf-save">Сохранить</button></div>`);
  if (isNew) setTimeout(() => $('#cf-name') && $('#cf-name').focus(), 50);
}

function saveCatForm() {
  const name = $('#cf-name').value.trim();
  const err = $('#cf-err');
  if (!name) { err.textContent = 'Введите название'; return; }
  const dup = S.cats.find(c => c.type === FORM.type && c.id !== FORM.id && c.name.toLowerCase() === name.toLowerCase());
  if (dup) { err.textContent = 'Такая категория уже есть'; return; }
  const rec = { name, icon: FORM.icon, type: FORM.type };
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

function catGridHTML() {
  const list = S.cats.filter(c => c.type === FORM.type && (!c.hidden || c.id === FORM.categoryId))
    .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, 'ru'));
  return list.map(c => `<button type="button" class="cat-tile ${c.id === FORM.categoryId ? 'on' : ''}" data-act="tx-cat" data-id="${esc(c.id)}">
      <span class="ic-circle">${catIcon(c)}</span><span class="cn">${esc(c.name)}</span></button>`).join('') +
    `<button type="button" class="cat-tile add" data-act="tx-newcat"><span class="ic-circle">${icon('plus')}</span><span class="cn">Новая</span></button>`;
}

function fitAmount() {
  const el = $('#tx-amount');
  if (el) el.style.width = Math.max(1, el.value.length) + 0.4 + 'ch';
}

/** draft — несохранённые значения формы (после создания категории из формы). */
function openTxForm(tx, draft) {
  const isNew = !tx;
  FORM = {
    kind: 'tx',
    id: tx ? tx.id : null,
    type: tx ? tx.type : (UI.lastType || 'expense'),
    categoryId: tx ? tx.categoryId : ''
  };
  const v = {
    amount: tx ? String(tx.amount).replace('.', ',') : '',
    date: tx ? tx.date : todayStr(),
    comment: tx ? tx.comment : ''
  };
  if (draft) {
    Object.assign(FORM, { type: draft.type, categoryId: draft.categoryId });
    Object.assign(v, { amount: draft.amount, date: draft.date, comment: draft.comment });
  }
  openModal(isNew ? 'Новая операция' : 'Операция', `
    <div class="seg wide" id="tx-type">
      <button type="button" data-act="tx-type" data-type="expense" class="${FORM.type === 'expense' ? 'on' : ''}">Расход</button>
      <button type="button" data-act="tx-type" data-type="income" class="${FORM.type === 'income' ? 'on' : ''}">Доход</button>
    </div>
    <div class="amount-row">
      <input id="tx-amount" class="amount-input" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(v.amount)}" aria-label="Сумма">
      <span class="amount-cur">${esc(cur())}</span>
    </div>
    <div class="section-label">Категория</div>
    <div class="cat-grid" id="tx-cats">${catGridHTML()}</div>
    <label class="field-label" for="tx-date">Дата</label>
    <div class="field">${icon('calendar')}<input id="tx-date" type="date" value="${esc(v.date)}"></div>
    <label class="field-label" for="tx-comment">Комментарий</label>
    <div class="field">${icon('message')}<input id="tx-comment" maxlength="200" autocomplete="off" value="${esc(v.comment)}" placeholder="Необязательно"></div>
    <div class="error-text" id="tx-err"></div>
    <div class="form-actions">
      <button type="button" class="btn primary block" data-act="tx-save">Сохранить</button>
      ${isNew ? '' : `<button type="button" class="btn danger block" data-act="tx-delete">${icon('trash')}Удалить операцию</button>`}
    </div>`);
  const amountEl = $('#tx-amount');
  amountEl.addEventListener('input', fitAmount);
  fitAmount();
  if (isNew && !draft) setTimeout(() => amountEl.focus(), 50);
}

function readTxDraft() {
  return {
    id: FORM.id, type: FORM.type, categoryId: FORM.categoryId,
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
  upsertTx({ id: FORM.id, type: FORM.type, amount, categoryId: FORM.categoryId, date, comment: $('#tx-comment').value.trim() });
  UI.lastType = FORM.type;
  if (ymOf(date) !== UI.month && !FORM.id) UI.month = ymOf(date);
  closeModal();
  toast('Сохранено');
  renderAll();
}

/* ===== Экран «Настройки» ===== */

function renderSettings() {
  const view = $('#view-settings');
  if (!view.querySelector('#st-url')) {
    view.innerHTML = `
      <div class="card">
        <div class="title-row">${icon('table')}<h3>Google Таблица</h3></div>
        <p class="sub">Операции сохраняются на телефоне и отправляются в таблицу, когда появляется интернет.</p>
        <label class="field-label" for="st-url">Адрес веб-приложения</label>
        <div class="field">${icon('link')}<input id="st-url" type="url" inputmode="url" autocomplete="off" spellcheck="false"
          placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.settings.url)}"></div>
        <label class="field-label" for="st-token">Ключ доступа</label>
        <div class="field">${icon('key')}<input id="st-token" type="password" autocomplete="off" spellcheck="false" value="${esc(S.settings.token)}"></div>
        <div class="form-actions"><button type="button" class="btn primary block" data-act="save-settings">${icon('refresh')}Сохранить и синхронизировать</button></div>
        <div class="sync-info" id="sync-info"></div>
      </div>
      <div class="card">
        <div class="title-row">${icon('coins')}<h3>Валюта</h3></div>
        <div class="field" style="margin-top:12px"><select id="st-cur" aria-label="Валюта">${CURRENCIES.map(([v, l]) =>
          `<option value="${esc(v)}" ${v === S.settings.currency ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${icon('chevron-right', 'chev')}</div>
      </div>
      <div class="card">
        <div class="title-row">${icon('download')}<h3>Данные</h3></div>
        <p class="sub" id="st-count"></p>
        <div class="form-actions" style="margin-top:14px"><button type="button" class="btn block" data-act="export-csv">Скачать операции (CSV)</button></div>
      </div>
      <div class="card">
        <div class="title-row">${icon('phone')}<h3>Установка на телефон</h3></div>
        <ul class="steps">
          <li>Android, Chrome: меню ⋮ → «Добавить на главный экран».</li>
          <li>iPhone, Safari: «Поделиться» → «На экран Домой».</li>
          <li>После установки приложение открывается и работает без интернета.</li>
        </ul>
      </div>
      <p class="version">Версия ${APP_VERSION}</p>`;
    $('#st-cur').addEventListener('change', e => {
      S.settings.currency = e.target.value;
      saveSettings();
      toast('Валюта сохранена');
    });
  }
  updateSyncInfo();
}

function updateSyncInfo() {
  const box = $('#sync-info');
  if (!box) return;
  const n = dirtyCount();
  const kv = (k, v, cls = '') => `<div class="kv ${cls}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  box.innerHTML =
    kv('Последняя синхронизация', S.meta.lastSync ? timeLabel(S.meta.lastSync) : 'ещё не было') +
    kv('Ждут отправки', String(n)) +
    kv('Интернет', navigator.onLine ? 'есть' : 'нет') +
    (UI.syncing ? kv('Сейчас', 'идёт синхронизация…') : '') +
    (S.meta.lastError ? kv('Ошибка', S.meta.lastError, 'err') : '');
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
  const rows = [['Дата', 'Тип', 'Сумма', 'Категория', 'Комментарий']];
  liveTx().slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).forEach(t => {
    const [y, m, d] = t.date.split('-');
    rows.push([`${d}.${m}.${y}`, t.type === 'income' ? 'Доход' : 'Расход', String(t.amount).replace('.', ','),
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
    $('#tx-cats').innerHTML = catGridHTML();
  },
  'tx-cat'(d) {
    FORM.categoryId = d.id;
    $$('#tx-cats .cat-tile').forEach(b => b.classList.toggle('on', b.dataset.id === d.id));
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
  'new-cat'() { openCatForm(null); },
  'edit-cat'(d) {
    const c = S.cats.find(x => x.id === d.id);
    if (c) openCatForm(c);
  },
  'cf-type'(d) {
    FORM.type = d.type;
    $$('#cf-type button').forEach(b => b.classList.toggle('on', b.dataset.type === d.type));
  },
  'cf-icon'(d) {
    FORM.icon = d.icon;
    $$('#cf-icons button').forEach(b => b.classList.toggle('on', b.dataset.icon === d.icon));
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
    if (FORM.kind === 'tx') saveTxForm();
    if (FORM.kind === 'cat') saveCatForm();
  }
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') ACTIONS['close-modal'](); });

/* ===== Запуск ===== */

// Иконки в разметке (<i data-icon="…">) → линейные SVG.
$$('i[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon); });

window.addEventListener('online', () => { renderBadge(); updateSyncInfo(); sync(false); });
window.addEventListener('offline', () => { renderBadge(); updateSyncInfo(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - S.meta.lastSync > 30000) sync(false);
});
setInterval(() => { if (dirtyCount()) sync(false); }, 60000);
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (UI.view === 'reports') renderReports(); }, 200);
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

renderAll();
sync(false);
