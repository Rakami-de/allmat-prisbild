// Pure geometry for the 1080×1080 export. No DOM: text measuring is injected so this runs
// under `node --test`. Three templates share one structure — a full-bleed photo, a list of
// flat shapes, a logo box, a price region and a text column — so the renderer stays generic.
// Colours are roles ('block', 'paper', 'on', 'ink', 'muted', 'accent') resolved per colourway.

export const SIZE = 1080;
export const TEMPLATES = ['sockel', 'kort', 'signatur'];

export const FONT = {
  price: 'Barlow Condensed',
  text: 'Noto Sans Arabic',
};

const S = SIZE;

const TEMPLATE = {
  // White plinth with the logo; the price is a colour block rising out of the corner.
  sockel: {
    photo: { x: 0, y: 0, w: S, h: 830 },
    shapes: [
      { type: 'rect', x: 0, y: 830, w: S, h: 250, fill: 'paper' },
      { type: 'rect', x: 0, y: 1068, w: 610, h: 12, fill: 'accent' },
      { type: 'rect', x: 610, y: 760, w: 470, h: 320, fill: 'block' },
    ],
    logo: { x: 52, y: 866, w: 160, h: 120 },
    brand: { x: 228, baseline: 916, size: 40 },
    // With no product text the logo and shop name stack, centred, and fill the plinth.
    idle: { logo: { x: 195, y: 846, w: 220, h: 146 }, brand: { cx: 305, baseline: 1040, size: 44 } },
    text: { x: 228, maxW: 360, name: { baseline: 966, size: 36 }, note: { baseline: 1010, size: 26 }, ink: 'ink', muted: 'muted', align: 'left' },
    price: { x: [650, 1040], y: [800, 1040], oldY: 776, max: 250, on: 'on' },
    pills: { x: 40, y: 40 },
  },

  // The photo fills everything; one floating card carries logo, name and a colour price cell.
  kort: {
    photo: { x: 0, y: 0, w: S, h: S },
    shapes: [
      { type: 'roundRect', x: 40, y: 800, w: 1000, h: 240, r: 36, fill: 'paper', shadow: true },
      { type: 'roundRect', x: 610, y: 800, w: 430, h: 240, r: [0, 36, 36, 0], fill: 'block' },
    ],
    logo: { x: 76, y: 830, w: 130, h: 96 },
    brand: { x: 220, baseline: 894, size: 34 },
    idle: { logo: { x: 70, y: 852, w: 180, h: 136 }, brand: { x: 262, baseline: 936, size: 38 } },
    text: { x: 80, maxW: 500, name: { baseline: 972, size: 34 }, note: { baseline: 1012, size: 24 }, ink: 'ink', muted: 'muted', align: 'left' },
    price: { x: [644, 1006], y: [836, 1006], oldY: 812, max: 230, on: 'on' },
    pills: { x: 40, y: 40 },
  },

  // Symmetric and formal: keyline frame, colour band, logo medallion sitting on the band's edge.
  signatur: {
    photo: { x: 0, y: 0, w: S, h: 850 },
    shapes: [
      { type: 'rect', x: 0, y: 830, w: S, h: 250, fill: 'block' },
      { type: 'strokeRect', x: 28, y: 28, w: 1024, h: 1024, line: 3, fill: 'on' },
      { type: 'circle', cx: 540, cy: 830, r: 104, fill: 'block' },
      { type: 'circle', cx: 540, cy: 830, r: 92, fill: 'paper' },
    ],
    logo: { x: 466, y: 774, w: 148, h: 112 },
    brand: null,
    text: { x: 60, maxW: 370, name: { baseline: 966, size: 54, caps: true }, note: { baseline: 1010, size: 26 }, ink: 'on', muted: 'onMuted', align: 'center' },
    price: { x: [656, 1022], y: [872, 1030], oldY: 846, max: 230, on: 'on' },
    pills: { x: 64, y: 64 },
  },
};

const INT_MIN = 80;
const RATIO = { dec: 0.42, kr: 0.2, multi: 0.26 };
const OLD_ROW = 30;
const PILL = { h: 60, padX: 24, size: 34, gap: 12 };

const font = (family, weight, size) => ({ family, weight, size });
const TAG_TEXT = { nyhet: 'NYHET', kampanj: 'KAMPANJ' };

// ---------- price ----------

function priceRow(size, { priceParts, unit, multiQty }, measure) {
  const intFont = font(FONT.price, 900, size);
  const int = measure(priceParts.int, intFont);
  const cap = measure('0', intFont).ascent;
  const small = (ratio, weight) => font(FONT.price, weight, Math.max(12, Math.round(size * ratio)));

  const parts = [];
  let cursor = 0;

  if (multiQty) {
    const multiFont = small(RATIO.multi, 700);
    const text = `${multiQty} för`;
    parts.push({ key: 'multi', text, font: multiFont, dx: 0, dy: 0 });
    cursor += measure(text, multiFont).width + Math.round(cap * 0.12);
  }

  parts.push({ key: 'int', text: priceParts.int, font: intFont, dx: cursor, dy: 0 });
  cursor += int.width + Math.round(size * 0.05);

  // One column right of the integer: decimals hang from the cap line, "kr/kg" sits on the baseline.
  const krFont = small(RATIO.kr, 600);
  const krText = `kr${unit}`;
  let column = measure(krText, krFont).width;
  if (priceParts.dec) {
    const decFont = small(RATIO.dec, 900);
    const dec = measure(priceParts.dec, decFont);
    parts.push({ key: 'dec', text: priceParts.dec, font: decFont, dx: cursor, dy: -cap + dec.ascent });
    column = Math.max(column, dec.width);
  }
  parts.push({ key: 'kr', text: krText, font: krFont, dx: cursor, dy: 0 });

  return { width: cursor + column, cap, parts };
}

function fitPrice(input, region, hasOld, measure) {
  const [x0, x1] = region.x;
  const y0 = region.y[0] + (hasOld ? OLD_ROW : 0);
  const y1 = region.y[1];
  let row = null;
  let fits = false;
  for (let size = region.max; size >= INT_MIN; size -= 2) {
    row = priceRow(size, input, measure);
    if (row.width <= x1 - x0 && row.cap <= y1 - y0) { fits = true; break; }
  }
  const left = Math.round((x0 + x1 - row.width) / 2);
  const baseline = Math.round((y0 + y1 + row.cap) / 2);
  const price = { fits, color: region.on, intSize: row.parts.find((p) => p.key === 'int').font.size, dec: null, multi: null, old: null };
  for (const part of row.parts) {
    price[part.key] = { text: part.text, font: part.font, x: left + part.dx, baseline: baseline + part.dy };
  }
  return price;
}

function oldPriceLine(oldParts, region, measure) {
  const [x0, x1] = region.x;
  const prefix = 'Ord. ';
  const amount = `${oldParts.int}${oldParts.dec ? `,${oldParts.dec}` : ''} kr`;
  const f = font(FONT.price, 600, 34);
  const full = measure(prefix + amount, f);
  const x = Math.round((x0 + x1 - full.width) / 2);
  const baseline = region.oldY + 34;
  return {
    text: prefix + amount, font: f, x, baseline,
    strike: { x1: x + measure(prefix, f).width, x2: x + full.width, y: Math.round(baseline - full.ascent * 0.45), width: 3 },
  };
}

// ---------- supporting text ----------

// One line: shrink first, then ellipsise. Reports overflow so the editor can ask for a shorter text.
function fitLine(text, { family, weight, size, minSize }, maxW, measure) {
  let f = font(family, weight, size);
  for (let s = size; s >= minSize; s -= 2) {
    f = font(family, weight, s);
    const width = measure(text, f).width;
    if (width <= maxW) return { text, font: f, overflow: false, width };
  }
  let cut = text;
  while (cut.length > 1 && measure(`${cut}…`, f).width > maxW) cut = cut.slice(0, -1).trimEnd();
  return { text: `${cut}…`, font: f, overflow: true, width: measure(`${cut}…`, f).width };
}

function placeLine(line, column, baseline) {
  const x = column.align === 'center' ? Math.round(column.x + (column.maxW - line.width) / 2) : column.x;
  return { text: line.text, font: line.font, x, baseline };
}

function pill(text, x, y, measure) {
  const f = font(FONT.price, 700, PILL.size);
  const m = measure(text, f);
  const w = Math.round(m.width + PILL.padX * 2);
  return { text, font: f, x, y, w, h: PILL.h, r: PILL.h / 2, textX: x + PILL.padX, baseline: Math.round(y + (PILL.h + m.ascent) / 2) };
}

// ---------- public ----------

export function computeLayout({ template = 'sockel', fields, priceParts, oldPriceParts = null, storeName = '', measure }) {
  const spec = TEMPLATE[template] ?? TEMPLATE.sockel;
  const showOld = fields.mode === 'kampanj' && oldPriceParts !== null;
  const warnings = [];

  const price = fitPrice(
    { priceParts, unit: fields.unit ?? '', multiQty: fields.multiQty?.trim() || '' },
    spec.price, showOld, measure,
  );
  if (showOld) price.old = oldPriceLine(oldPriceParts, spec.price, measure);
  if (!price.fits) warnings.push('price-overflow');

  // Tag and weight share one row in the photo's top corner.
  let pillX = spec.pills.x;
  let tag = null;
  let weight = null;
  if (TAG_TEXT[fields.mode]) {
    tag = pill(TAG_TEXT[fields.mode], pillX, spec.pills.y, measure);
    pillX += tag.w + PILL.gap;
  }
  if (fields.weight?.trim()) weight = pill(fields.weight.trim(), pillX, spec.pills.y, measure);

  const column = spec.text;
  let name = null;
  let note = null;
  // Templates without a brand line (Signatur) show the shop name where the product name would be.
  const nameText = fields.name?.trim() || (spec.brand ? '' : storeName);
  if (nameText) {
    const raw = column.name.caps ? nameText.toLocaleUpperCase('sv') : nameText;
    const family = column.name.caps ? FONT.price : FONT.text;
    const line = fitLine(raw, { family, weight: 600, size: column.name.size, minSize: column.name.size - 10 }, column.maxW, measure);
    if (line.overflow) warnings.push('name-overflow');
    name = { ...placeLine(line, column, column.name.baseline), color: column.ink };
  }
  if (fields.note?.trim()) {
    const line = fitLine(fields.note.trim(), { family: FONT.text, weight: 400, size: column.note.size, minSize: column.note.size - 4 }, column.maxW, measure);
    if (line.overflow) warnings.push('note-overflow');
    // Without a name the note moves up into the name's place.
    note = { ...placeLine(line, column, name ? column.note.baseline : column.name.baseline), color: column.muted };
  }

  const idle = !name && !note && spec.idle ? spec.idle : null;
  return {
    size: SIZE, template,
    photo: spec.photo, shapes: spec.shapes, logo: idle?.logo ?? spec.logo, brand: idle?.brand ?? spec.brand,
    price, tag, weight, name, note, warnings,
  };
}

export const photoSlot = (template) => (TEMPLATE[template] ?? TEMPLATE.sockel).photo;
