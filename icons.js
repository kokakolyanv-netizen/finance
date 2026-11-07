'use strict';

/* Линейные иконки: сетка 24×24, обводка 1.75, скруглённые концы. Своя отрисовка, работает офлайн. */
const ICON_PATHS = {
  // ---- интерфейс ----
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  pie: '<path d="M21 13.5A9 9 0 1 1 10.5 3"/><path d="M14 3.2A8 8 0 0 1 20.8 10H14z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  'chevron-left': '<path d="M14.5 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  refresh: '<path d="M19.5 10.5A7.5 7.5 0 0 0 6.2 7.2L4.5 9"/><path d="M4.5 4.5V9H9"/><path d="M4.5 13.5a7.5 7.5 0 0 0 13.3 3.3l1.7-1.8"/><path d="M19.5 19.5V15H15"/>',
  'arrow-in': '<path d="M17 7L7 17M16 17H7V8"/>',
  'arrow-out': '<path d="M7 17L17 7M8 7h9v9"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  trash: '<path d="M4.5 7h15M10 11v5.5M14 11v5.5M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M9.5 7V4.5h5V7"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  message: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-9l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z"/>',
  table: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9.5h16M4 14.8h16M9.5 9.5V20"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5L19 9M14.5 8.5L16.5 10.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  // ---- категории ----
  cart: '<circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/><path d="M3 4h2.2l2.2 10.6a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L20 8H6.3"/>',
  bag: '<path d="M5.5 8h13l-1 11.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  utensils: '<path d="M6.5 3v5a2 2 0 0 0 4 0V3M8.5 10v11"/><path d="M17.5 21V3c-1.9 1.2-3 3.6-3 7v3.5h3"/>',
  coffee: '<path d="M4.5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M15.5 10.5h1.2a2.5 2.5 0 0 1 0 5h-1.6"/><path d="M8 3.5v2.5M12 3.5v2.5M4 21h12"/>',
  wine: '<path d="M8 3h8l-.4 5.2a3.6 3.6 0 0 1-7.2 0z"/><path d="M12 11.8V20M8.5 20h7"/>',
  bus: '<rect x="4.5" y="3.5" width="15" height="14" rx="3"/><path d="M4.5 11h15M8 17.5V20M16 17.5V20M8.5 14.3h.01M15.5 14.3h.01"/>',
  train: '<rect x="5.5" y="3.5" width="13" height="13.5" rx="3"/><path d="M5.5 10h13M9 20.5l1.3-3.5M15 20.5l-1.3-3.5M9.5 13.5h.01M14.5 13.5h.01"/>',
  car: '<path d="M4.5 16.5v-4l1.9-5a2 2 0 0 1 1.9-1.3h7.4a2 2 0 0 1 1.9 1.3l1.9 5v4a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z"/><path d="M4.5 12.5h15M7.5 17.5v2M16.5 17.5v2M8 15h.01M16 15h.01"/>',
  fuel: '<path d="M5 20.5V5.5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M3.5 20.5h12M5 10h9"/><path d="M14 8.5h1.5a2 2 0 0 1 2 2V16a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l3.5-7h6L18 16M9.5 9L8 6H6M12 16l3.5-7"/>',
  plane: '<path d="M10.2 13.8L5 12.5l-1.5 1.5 4.8 2.2 2.2 4.8 1.5-1.5-1.3-5.2 5.8-5.8 2.2 6.6 1.5-1.5-.6-8.4 1.6-1.6a1.8 1.8 0 0 0-2.5-2.5l-1.6 1.6-8.4-.6-1.5 1.5 6.6 2.2z"/>',
  suitcase: '<rect x="4.5" y="7" width="15" height="13" rx="2.5"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M9 11v5M15 11v5"/>',
  umbrella: '<path d="M21 12.5a9 9 0 0 0-18 0z"/><path d="M12 12.5v6a2 2 0 0 0 4 0M12 2.5v1"/>',
  home: '<path d="M4 10.5L12 4l8 6.5v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
  zap: '<path d="M13 3L5 13.5h6.5L11 21l8-10.5h-6.5z"/>',
  droplet: '<path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5z"/>',
  sofa: '<path d="M5 11V8.5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3V11"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M5.5 19v1.5M18.5 19v1.5"/>',
  roller: '<rect x="4" y="3.5" width="13" height="5" rx="1.5"/><path d="M17 6h2.5v5H12v3"/><rect x="10.5" y="14" width="3" height="6.5" rx="1"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.8h2"/>',
  wifi: '<path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.5a4 4 0 0 1 6 0"/><path d="M12 19.5h.01"/>',
  laptop: '<rect x="5" y="5" width="14" height="10.5" rx="1.5"/><path d="M3 19h18"/>',
  pill: '<path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="M8.5 8.5l7 7"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 6.8a4.2 4.2 0 0 1 7.5 2.7c0 5.4-7.5 10-7.5 10z"/>',
  shirt: '<path d="M9 3.5L4 5.5 2.8 10l3.2.8V20.5h12V10.8l3.2-.8L20 5.5l-5-2a3 3 0 0 1-6 0z"/>',
  sparkles: '<path d="M11 3.5l1.6 4.9L17.5 10l-4.9 1.6L11 16.5l-1.6-4.9L4.5 10l4.9-1.6z"/><path d="M18 14.5v5M15.5 17h5"/>',
  scissors: '<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M8.5 8L20 19M8.5 16L20 5"/>',
  film: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  tv: '<rect x="3" y="5" width="18" height="12.5" rx="2.5"/><path d="M8.5 20.5h7M10.5 8.8v5.4l4.3-2.7z"/>',
  music: '<path d="M9 17.5V5.5l11-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>',
  gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="4.5"/><path d="M7.5 10.5v4M5.5 12.5h4M15 11.5h.01M17.5 13.5h.01"/>',
  book: '<path d="M3 5h5.5A3.5 3.5 0 0 1 12 8.5v11a2.5 2.5 0 0 0-2.5-2.5H3z"/><path d="M21 5h-5.5A3.5 3.5 0 0 0 12 8.5v11a2.5 2.5 0 0 1 2.5-2.5H21z"/>',
  graduation: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c0 1.3 2.5 3 5.5 3s5.5-1.7 5.5-3v-4.5M21.5 9.5V15"/>',
  balloon: '<path d="M12 15.5c-3.3 0-6-2.9-6-6.3S8.7 3 12 3s6 2.8 6 6.2-2.7 6.3-6 6.3z"/><path d="M11 17.5h2M12 17.5c0 1.5-1.5 2-1.5 3.5"/>',
  paw: '<circle cx="6" cy="11" r="1.7"/><circle cx="9.3" cy="6.5" r="1.7"/><circle cx="14.7" cy="6.5" r="1.7"/><circle cx="18" cy="11" r="1.7"/><path d="M12 12.5c-2.4 0-4.8 3-4.8 5.3 0 1.4 1 2.4 2.4 2.4.9 0 1.6-.5 2.4-.5s1.5.5 2.4.5c1.4 0 2.4-1 2.4-2.4 0-2.3-2.4-5.3-4.8-5.3z"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M12 8v12.5M5.5 12v7a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-7"/><path d="M12 8S10.5 3.5 8 3.5a2.2 2.2 0 0 0 0 4.5M12 8s1.5-4.5 4-4.5a2.2 2.2 0 0 1 0 4.5"/>',
  cake: '<path d="M4.5 20.5V13a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7.5"/><path d="M4.5 15.5c1.2 0 1.2 1 2.5 1s1.3-1 2.5-1 1.3 1 2.5 1 1.3-1 2.5-1 1.3 1 2.5 1 1.3-1 2.5-1M3 20.5h18M12 11V8M12 4.8h.01"/>',
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  camera: '<path d="M3.5 8.5a2 2 0 0 1 2-2h2l1.5-2h6l1.5 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c.9 0 1.5-.6 1.5-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4h1.8a4.5 4.5 0 0 0 4.5-4.5c0-4.2-3.8-7.7-8.5-7.7z"/><path d="M7.5 12h.01M9.5 8h.01M14.5 8h.01"/>',
  leaf: '<path d="M5.5 19.5C5 11 10 5 19.5 4.5 19.5 14 14 19 6.5 19"/><path d="M5.5 19.5c2.5-4 5.5-6.5 9-8.5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 14.5h3"/>',
  receipt: '<path d="M5.5 3.5h13v17l-2.2-1.4-2.1 1.4-2.2-1.4-2.2 1.4-2.1-1.4-2.2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  box: '<path d="M4 7.5L12 3.5l8 4v9l-8 4-8-4z"/><path d="M4 7.5l8 4 8-4M12 11.5v9"/>',
  briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
  wrench: '<path d="M14.5 6.5a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a5.5 5.5 0 0 1-7.3 7.3l-6.4 6.4a2 2 0 0 1-2.8-2.8l6.4-6.4a5.5 5.5 0 0 1 7.3-7.3z"/>',
  star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/>',
  building: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 7.5h.01M15 7.5h.01M9 11h.01M15 11h.01M9 14.5h.01M15 14.5h.01M10.5 20.5v-3h3v3"/>',
  percent: '<path d="M18.5 5.5l-13 13"/><circle cx="7.5" cy="7.5" r="2.3"/><circle cx="16.5" cy="16.5" r="2.3"/>',
  trend: '<path d="M3.5 17l5.5-5.5 4 4 7.5-7.5"/><path d="M15 8h5.5v5.5"/>',
  repeat: '<path d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20M16.5 3L20 6.5 16.5 10"/><path d="M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4M7.5 21L4 17.5 7.5 14"/>',
  tag: '<path d="M3.5 4.5v6.6a1.5 1.5 0 0 0 .4 1l8 8a1.5 1.5 0 0 0 2.1 0l6.1-6.1a1.5 1.5 0 0 0 0-2.1l-8-8a1.5 1.5 0 0 0-1-.4H5a1.5 1.5 0 0 0-1.5 1.5z"/><path d="M8 8h.01"/>',
  landmark: '<path d="M3.5 20.5h17M5.5 17v-6M10 17v-6M14 17v-6M18.5 17v-6M3.5 8.5L12 3.5l8.5 5z"/>',
  coins: '<circle cx="9" cy="9" r="5.5"/><path d="M15.2 9.6a5.5 5.5 0 1 1-5.6 5.6"/>',
  wallet: '<path d="M18.5 7V5.5A1.5 1.5 0 0 0 17 4H6a2 2 0 0 0 0 4h13a1.5 1.5 0 0 1 1.5 1.5V12"/><path d="M4 6v12.5A1.5 1.5 0 0 0 5.5 20H19a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="M20.5 12H17a2 2 0 0 0 0 4h3.5z"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 16.5h.01"/>'
};

// Иконки, которые можно выбрать для категории (в этом порядке).
const CATEGORY_ICON_KEYS = ['cart', 'bag', 'utensils', 'coffee', 'wine', 'bus', 'train', 'car', 'fuel', 'bike', 'plane',
  'suitcase', 'umbrella', 'home', 'bulb', 'zap', 'droplet', 'sofa', 'roller', 'phone', 'wifi', 'laptop', 'pill', 'heart',
  'shirt', 'sparkles', 'scissors', 'film', 'tv', 'music', 'gamepad', 'book', 'graduation', 'balloon', 'paw', 'gift', 'cake',
  'dumbbell', 'camera', 'palette', 'leaf', 'card', 'receipt', 'box', 'briefcase', 'wrench', 'star', 'building', 'percent',
  'trend', 'repeat', 'tag', 'landmark', 'coins', 'wallet'];

// Старые иконки-эмодзи (первая версия приложения) → линейные иконки.
const EMOJI_ICON_MAP = {
  '🛒': 'cart', '🍽️': 'utensils', '🍔': 'utensils', '☕': 'coffee', '🍷': 'wine', '🚌': 'bus', '🚕': 'car', '🚗': 'car',
  '⛽': 'fuel', '🚲': 'bike', '🏠': 'home', '🧺': 'home', '💡': 'bulb', '📱': 'phone', '💻': 'laptop', '💊': 'pill',
  '🏥': 'pill', '👕': 'shirt', '👟': 'shirt', '💄': 'sparkles', '💇': 'sparkles', '🧴': 'sparkles', '🎬': 'film',
  '🎮': 'gamepad', '🎵': 'music', '📺': 'tv', '📚': 'book', '🎓': 'graduation', '🧸': 'balloon', '👶': 'balloon',
  '🍼': 'balloon', '🐾': 'paw', '🎁': 'gift', '🎉': 'gift', '✈️': 'plane', '🏖️': 'umbrella', '⚽': 'dumbbell',
  '🏋️': 'dumbbell', '🔨': 'roller', '🛋️': 'sofa', '💳': 'card', '🧾': 'receipt', '🤝': 'heart', '📦': 'box',
  '💼': 'briefcase', '🛠️': 'wrench', '🏆': 'star', '🏢': 'building', '🏦': 'percent', '📈': 'trend', '🔁': 'repeat',
  '🏷️': 'tag', '🏛️': 'landmark', '⛪': 'landmark', '💰': 'coins', '💵': 'coins', '🌿': 'leaf', '🎨': 'palette',
  '📷': 'camera', '🧳': 'suitcase', '🚬': 'tag', '🎂': 'cake'
};

function iconKey(v) {
  if (v && ICON_PATHS[v]) return v;
  return EMOJI_ICON_MAP[v] || 'tag';
}

function icon(name, cls) {
  const body = ICON_PATHS[name] || ICON_PATHS.tag;
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
