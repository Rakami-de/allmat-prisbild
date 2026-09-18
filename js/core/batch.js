import { parsePrice, parseMultiBuy } from './price.js';
import { TEMPLATES } from './layout.js';

export const COLORWAYS = ['rod', 'gron', 'svart', 'gul'];
export const LIST_STYLES = ['ljus', 'mork', 'farg'];
export { TEMPLATES };
export const UNITS = ['', '/kg', '/st', '/förp', '/liter', '/100g'];
export const MODES = ['standard', 'nyhet', 'kampanj'];

const BLANK_FIELDS = {
  price: '', unit: '', weight: '', name: '', note: '',
  mode: 'standard', oldPrice: '', multiQty: '',
};
const BLANK_LIST = { style: 'ljus', title: 'Veckans erbjudanden', note: '', footer: '' };
const ALLOWED = { unit: UNITS, mode: MODES };
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function createBatch() {
  return { template: 'sockel', colorway: 'rod', list: { ...BLANK_LIST }, items: [] };
}

export function addItem(batch, { id, photoKey }) {
  const item = { id, photoKey, fields: { ...BLANK_FIELDS }, crop: { x: 0.5, y: 0.5, zoom: 1 } };
  return { ...batch, items: [...batch.items, item] };
}

export function removeItem(batch, id) {
  return { ...batch, items: batch.items.filter((item) => item.id !== id) };
}

export function moveItem(batch, id, toIndex) {
  const from = batch.items.findIndex((item) => item.id === id);
  if (from === -1) return batch;
  const items = [...batch.items];
  const [item] = items.splice(from, 1);
  items.splice(clamp(toIndex, 0, items.length), 0, item);
  return { ...batch, items };
}

function mapItem(batch, id, fn) {
  return { ...batch, items: batch.items.map((item) => (item.id === id ? fn(item) : item)) };
}

export function updateFields(batch, id, patch) {
  const safe = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in BLANK_FIELDS)) continue;
    if (ALLOWED[key] && !ALLOWED[key].includes(value)) continue;
    safe[key] = String(value);
  }
  return mapItem(batch, id, (item) => ({ ...item, fields: { ...item.fields, ...safe } }));
}

export function updateCrop(batch, id, patch) {
  return mapItem(batch, id, (item) => {
    const next = { ...item.crop, ...patch };
    return { ...item, crop: { x: clamp(next.x, 0, 1), y: clamp(next.y, 0, 1), zoom: clamp(next.zoom, 1, 4) } };
  });
}

export function setColorway(batch, colorway) {
  return COLORWAYS.includes(colorway) ? { ...batch, colorway } : batch;
}

export function setTemplate(batch, template) {
  return TEMPLATES.includes(template) ? { ...batch, template } : batch;
}

// Options that only the Lista template uses: sheet style and the three free-text lines.
export function setListOptions(batch, patch) {
  const list = { ...BLANK_LIST, ...batch.list };
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in BLANK_LIST)) continue;
    if (key === 'style' && !LIST_STYLES.includes(value)) continue;
    list[key] = String(value);
  }
  return { ...batch, list };
}

export function itemStatus(item) {
  const { price, mode, oldPrice, multiQty } = item.fields;
  const parsed = parsePrice(price);
  if (!parsed.ok) return parsed.reason === 'empty' ? 'missing-price' : 'invalid-price';
  if (multiQty.trim() !== '' && !parseMultiBuy(multiQty, price).ok) return 'invalid-price';
  if (mode === 'kampanj' && !parsePrice(oldPrice).ok) return 'invalid-old-price';
  return 'ready';
}

export function readyItems(batch) {
  return batch.items.filter((item) => itemStatus(item) === 'ready');
}
