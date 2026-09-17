// Pure geometry for the 1080×1080 export. No DOM: text measuring is injected so this
// runs under `node --test`. Base composition: docs/design/price-badge.md, with two
// deliberate departures — the photo is cover-fitted into a taller slot (user pans/zooms it)
// and the badge overlaps the photo's lower-right corner like a shelf sticker.

export const SIZE = 1080;

export const FONT = {
  price: 'Barlow Condensed',
  text: 'Noto Sans Arabic',
};

export const GEOMETRY = {
  frame: 20,
  frameSideGron: 32,
  photo: { x: 48, y: 144, w: 984, h: 720, r: 22 },
  logoBox: { x: 48, y: 32, w: 136, h: 104 },
  brand: { x: 196, baseline: 106, size: 60, gap: 14 },
  badge: { x: 456, y: 752, w: 576, h: 280, r: 42, stroke: 6 },
  priceX: [484, 1004],
  priceY: [788, 1008],
  priceYWithOld: [826, 1008],
  oldPriceY: [774, 812],
  tag: { right: 1032, y: 52, h: 64, padX: 26, size: 38 },
  stack: { x: 48, top: 884, bottom: 1032, maxW: 384, gap: 14 },
  weight: { x: 68, bottomInset: 20, h: 48, padX: 16, size: 26, minSize: 20, maxW: 384 },
};

const INT_MAX = 290;
const INT_MIN = 96;
const RATIO = { dec: 0.48, kr: 0.24, unit: 0.26, multi: 0.3 };
const UNIT_GAP = 10;
const KR_GAP = 8;

const font = (family, weight, size) => ({ family, weight, size });
const TAG_TEXT = { nyhet: 'NYHET', kampanj: 'KAMPANJ' };

// ---------- price block ----------

function priceRow(size, { priceParts, unit, multiQty }, measure) {
  const intFont = font(FONT.price, 900, size);
  const int = measure(priceParts.int, intFont);
  const cap = measure('0', intFont).ascent;

  const small = (ratio, weight) => font(FONT.price, weight, Math.round(size * ratio));
  const krFont = small(RATIO.kr, 700);
  const kr = measure('kr', krFont);
  const gap = Math.round(cap * 0.055);

  const parts = [];
  let cursor = 0;

  if (multiQty) {
    const multiFont = small(RATIO.multi, 700);
    const text = `${multiQty} för`;
    parts.push({ key: 'multi', text, font: multiFont, dx: 0, dy: 0 });
    cursor += measure(text, multiFont).width + Math.round(cap * 0.12);
  }

  parts.push({ key: 'int', text: priceParts.int, font: intFont, dx: cursor, dy: 0 });
  cursor += int.width + gap;

  if (priceParts.dec) {
    const decFont = small(RATIO.dec, 900);
    const dec = measure(priceParts.dec, decFont);
    // Decimals hang from the integer's cap line; "kr" sits under them in the same column.
    const decBaseline = -cap + dec.ascent;
    parts.push({ key: 'dec', text: priceParts.dec, font: decFont, dx: cursor, dy: decBaseline });
    parts.push({ key: 'kr', text: 'kr', font: krFont, dx: cursor, dy: decBaseline + KR_GAP + kr.ascent });
    cursor += Math.max(dec.width, kr.width);
  } else {
    parts.push({ key: 'kr', text: 'kr', font: krFont, dx: cursor, dy: 0 });
    cursor += kr.width;
  }

  let height = cap;
  let unitPart = null;
  if (unit) {
    const unitFont = small(RATIO.unit, 700);
    const m = measure(unit, unitFont);
    unitPart = { text: unit, font: unitFont, width: m.width, dy: UNIT_GAP + m.ascent };
    height += UNIT_GAP + m.ascent + m.descent;
  }
  return { width: cursor, height, cap, parts, unitPart };
}

function fitPrice(input, interval, measure) {
  const [x0, x1] = GEOMETRY.priceX;
  const [y0, y1] = interval;
  let row = null;
  let fits = false;
  for (let size = INT_MAX; size >= INT_MIN; size -= 1) {
    row = priceRow(size, input, measure);
    if (row.width <= x1 - x0 && row.height <= y1 - y0) { fits = true; break; }
  }

  const left = Math.round((x0 + x1 - row.width) / 2);
  const baseline = Math.round((y0 + y1 - row.height) / 2 + row.cap);
  const price = { fits, intSize: row.parts.find((p) => p.key === 'int').font.size, dec: null, multi: null, unit: null };
  for (const part of row.parts) {
    price[part.key] = { text: part.text, font: part.font, x: left + part.dx, baseline: baseline + part.dy };
  }
  if (row.unitPart) {
    const { text, font: unitFont, width, dy } = row.unitPart;
    price.unit = { text, font: unitFont, x: Math.round((x0 + x1 - width) / 2), baseline: baseline + dy };
  }
  return price;
}

function oldPriceLine(oldParts, measure) {
  const [x0, x1] = GEOMETRY.priceX;
  const [y0, y1] = GEOMETRY.oldPriceY;
  const prefix = 'Ord. ';
  const amount = `${oldParts.int}${oldParts.dec ? `,${oldParts.dec}` : ''} kr`;
  let f;
  let full;
  for (let size = 30; size >= 24; size -= 1) {
    f = font(FONT.price, 600, size);
    full = measure(prefix + amount, f);
    if (full.width <= x1 - x0) break;
  }
  const x = Math.round((x0 + x1 - full.width) / 2);
  const baseline = Math.round((y0 + y1 + full.ascent) / 2);
  const strikeStart = x + measure(prefix, f).width;
  return {
    text: prefix + amount, font: f, x, baseline,
    strike: { x1: strikeStart, x2: x + full.width, y: Math.round(baseline - full.ascent * 0.42), width: 2 },
  };
}

// ---------- supporting text ----------

function wrap(text, f, maxW, maxLines, measure) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, f).width <= maxW || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);

  let overflow = lines.length > maxLines || lines.some((l) => measure(l, f).width > maxW);
  const kept = lines.slice(0, maxLines);
  if (overflow) {
    let last = kept[kept.length - 1];
    if (lines.length > maxLines) last += '…';
    while (last.length > 1 && measure(last, f).width > maxW) last = `${last.slice(0, -2).trimEnd()}…`;
    kept[kept.length - 1] = last;
  }
  return { lines: kept, overflow };
}

function textBlock(text, { family, weight, sizes, lineHeight, maxLines }, top, measure) {
  const { x, maxW } = GEOMETRY.stack;
  let result;
  let f;
  for (const size of sizes) {
    f = font(family, weight, size);
    result = wrap(text, f, maxW, maxLines, measure);
    if (!result.overflow) break;
  }
  const ascent = measure('Ålg', f).ascent;
  const lines = result.lines.map((line, i) => ({
    text: line, x, baseline: Math.round(top + i * lineHeight + (lineHeight + ascent) / 2),
  }));
  return { font: f, lines, overflow: result.overflow, height: lines.length * lineHeight };
}

function weightPill(text, measure) {
  const g = GEOMETRY.weight;
  let f;
  let m;
  for (let size = g.size; size >= g.minSize; size -= 2) {
    f = font(FONT.text, 700, size);
    m = measure(text, f);
    if (m.width + g.padX * 2 <= g.maxW) break;
  }
  const w = Math.min(g.maxW, Math.round(m.width + g.padX * 2));
  const y = GEOMETRY.photo.y + GEOMETRY.photo.h - g.bottomInset - g.h;
  return {
    text, font: f, x: g.x, y, w, h: g.h, r: g.h / 2,
    textX: g.x + g.padX, baseline: Math.round(y + (g.h + m.ascent) / 2),
    overflow: m.width + g.padX * 2 > g.maxW,
  };
}

function modeTag(mode, measure) {
  const text = TAG_TEXT[mode];
  if (!text) return null;
  const g = GEOMETRY.tag;
  const f = font(FONT.price, 700, g.size);
  const m = measure(text, f);
  const w = Math.round(m.width + g.padX * 2);
  return {
    text, font: f, x: g.right - w, y: g.y, w, h: g.h, r: g.h / 2,
    textX: g.right - w + g.padX, baseline: Math.round(g.y + (g.h + m.ascent) / 2),
  };
}

// ---------- public ----------

export function computeLayout({ fields, priceParts, oldPriceParts = null, colorway = 'rod', measure }) {
  const showOld = fields.mode === 'kampanj' && oldPriceParts !== null;
  const multiQty = fields.multiQty?.trim() || '';

  const price = fitPrice(
    { priceParts, unit: fields.unit, multiQty },
    showOld ? GEOMETRY.priceYWithOld : GEOMETRY.priceY,
    measure,
  );
  price.old = showOld ? oldPriceLine(oldPriceParts, measure) : null;

  const warnings = [];
  if (!price.fits) warnings.push('price-overflow');

  const weight = fields.weight?.trim() ? weightPill(fields.weight.trim(), measure) : null;
  if (weight?.overflow) warnings.push('weight-overflow');

  let top = GEOMETRY.stack.top;
  let name = null;
  let note = null;
  if (fields.name?.trim()) {
    name = textBlock(fields.name, { family: FONT.price, weight: 700, sizes: [44, 40, 34], lineHeight: 48, maxLines: 2 }, top, measure);
    if (name.overflow) warnings.push('name-overflow');
    top += name.height + GEOMETRY.stack.gap;
  }
  if (fields.note?.trim()) {
    const room = Math.floor((GEOMETRY.stack.bottom - top) / 36);
    note = textBlock(fields.note, { family: FONT.text, weight: 500, sizes: [24], lineHeight: 36, maxLines: Math.max(1, Math.min(2, room)) }, top, measure);
    if (note.overflow) warnings.push('note-overflow');
  }

  const side = colorway === 'gron' ? GEOMETRY.frameSideGron : GEOMETRY.frame;
  return {
    size: SIZE,
    frame: { top: GEOMETRY.frame, side },
    photo: GEOMETRY.photo,
    logoBox: GEOMETRY.logoBox,
    brand: GEOMETRY.brand,
    badge: GEOMETRY.badge,
    price, tag: modeTag(fields.mode, measure), weight, name, note, warnings,
  };
}
