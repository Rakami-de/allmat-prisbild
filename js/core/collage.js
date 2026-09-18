// Pure geometry for the "Lista" template: many products on one sheet, each with its price tag.
// Like layout.js this has no DOM; text measuring is injected.

import { FONT, fitPrice } from './layout.js';

export const LIST_STYLES = ['ljus', 'mork', 'farg'];
export const PAGE_MAX = 20;
export const W = 1080;

const PAD = 44;
const HEAD = 170;
const FOOT = 70;

const font = (family, weight, size) => ({ family, weight, size });

// Balanced pages: 25 products become 13 + 12, never 20 + 5.
export function planPages(count) {
  if (count <= 0) return [];
  const pages = Math.ceil(count / PAGE_MAX);
  const size = Math.ceil(count / pages);
  return Array.from({ length: pages }, (_, i) => ({ start: i * size, end: Math.min(count, (i + 1) * size) }));
}

// Few products keep the square format; more get the taller 4:5 sheet, which Facebook shows larger.
export function pageGrid(n) {
  if (n <= 1) return { cols: 1, H: 1080 };
  if (n <= 4) return { cols: 2, H: 1080 };
  if (n <= 9) return { cols: 3, H: n <= 6 ? 1080 : 1350 };
  if (n <= 12) return { cols: 3, H: 1350 };
  return { cols: 4, H: 1350 };
}

function fitText(text, spec, maxW, measure) {
  let f = font(spec.family, spec.weight, spec.size);
  for (let s = spec.size; s >= spec.minSize; s -= 2) {
    f = font(spec.family, spec.weight, s);
    if (measure(text, f).width <= maxW) return { text, font: f, width: measure(text, f).width };
  }
  let cut = text;
  while (cut.length > 1 && measure(`${cut}…`, f).width > maxW) cut = cut.slice(0, -1).trimEnd();
  return { text: `${cut}…`, font: f, width: measure(`${cut}…`, f).width };
}

function cell({ x, y, w, h, cols }, entry, measure) {
  // The name is optional, and dropped on dense sheets where it would be unreadable. A card that
  // shows a name gets a taller tag, so the price under it stays as large as on a card without.
  const rawName = entry.fields.name?.trim();
  const showName = Boolean(rawName) && Math.min(h * 0.34, w * 0.42) >= 80;
  const tagH = Math.round(showName ? Math.min(h * 0.44, w * 0.52) : Math.min(h * 0.34, w * 0.42));
  const tag = { x, y: y + h - tagH, w, h: tagH };
  const photo = { x, y, w, h: h - tagH };

  let name = null;
  let priceTop = tag.y + Math.round(tagH * 0.12);
  if (showName) {
    const size = Math.round(tagH * 0.17);
    const line = fitText(rawName.toLocaleUpperCase('sv'), { family: FONT.price, weight: 600, size, minSize: Math.max(14, size - 8) }, w - 24, measure);
    name = { text: line.text, font: line.font, x: Math.round(x + (w - line.width) / 2), baseline: tag.y + size + Math.round(tagH * 0.07) };
    priceTop = name.baseline + Math.round(tagH * 0.07);
  }

  const price = fitPrice(
    { priceParts: entry.priceParts, unit: entry.fields.unit ?? '', multiQty: entry.fields.multiQty?.trim() || '' },
    { x: [x + 12, x + w - 12], y: [priceTop, tag.y + tagH - Math.round(tagH * 0.1)], max: Math.round(tagH * 1.1), min: 18, on: 'tagInk' },
    false, measure,
  );
  return { x, y, w, h, r: cols >= 4 ? 16 : 22, photo, tag, name, price };
}

export function computeCollagePage({ entries, title = '', note = '', footer = '', pageLabel = '', measure }) {
  const n = entries.length;
  const { cols, H } = pageGrid(n);
  const gap = cols >= 4 ? 14 : 18;
  const rows = Math.ceil(n / cols);
  const cw = (W - PAD * 2 - gap * (cols - 1)) / cols;
  const ch = (H - HEAD - FOOT - 16 - gap * (rows - 1)) / rows;

  const cells = entries.map((entry, i) => {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    // A short last row is centred instead of hugging the left edge.
    const offset = ((cols - inRow) * (cw + gap)) / 2;
    const box = { x: Math.round(PAD + offset + (i % cols) * (cw + gap)), y: Math.round(HEAD + row * (ch + gap)), w: Math.round(cw), h: Math.round(ch), cols };
    return cell(box, entry, measure);
  });

  // Header: logo, then the title as a label with the shop name under it; the note sits right.
  const logo = { x: PAD, y: 28, w: 152, h: HEAD - 56 };
  const x0 = logo.x + logo.w + 26;
  let titleBlock = null;
  if (title.trim()) {
    const line = fitText(title.trim().toLocaleUpperCase('sv'), { family: FONT.price, weight: 900, size: 64, minSize: 34 }, W - PAD - x0 - 28, measure);
    const size = line.font.size;
    titleBlock = {
      text: line.text, font: line.font, x: x0 + 14, baseline: 100,
      label: { x: x0, y: 100 - Math.round(size * 0.84), w: Math.round(line.width + 28), h: Math.round(size * 1.06), r: 10 },
    };
  }
  const brand = { x: x0, baseline: titleBlock ? 146 : 108, size: titleBlock ? 30 : 48 };
  let noteLine = null;
  if (note.trim()) {
    const line = fitText(note.trim(), { family: FONT.text, weight: 500, size: 24, minSize: 18 }, 420, measure);
    noteLine = { text: line.text, font: line.font, x: Math.round(W - PAD - line.width), baseline: brand.baseline };
  }

  const footY = H - FOOT;
  let footerLine = null;
  if (footer.trim()) {
    const line = fitText(footer.trim(), { family: FONT.text, weight: 500, size: 22, minSize: 16 }, W - PAD * 2 - 140, measure);
    footerLine = { text: line.text, font: line.font, x: Math.round((W - line.width) / 2), baseline: footY + 44 };
  }
  let pageMark = null;
  if (pageLabel) {
    const f = font(FONT.price, 700, 24);
    pageMark = { text: pageLabel, font: f, x: Math.round(W - PAD - measure(pageLabel, f).width), baseline: footY + 44 };
  }

  return {
    W, H, cols, rows, cells, logo, title: titleBlock, brand, note: noteLine,
    rule: { x: PAD, y: footY, w: W - PAD * 2, h: 2 }, footer: footerLine, pageMark,
  };
}
