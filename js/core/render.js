import { computeLayout, FONT, SIZE } from './layout.js';
import { parsePrice, formatPriceParts } from './price.js';
import { STORE } from '../config/store.js';

const FONT_FILES = [
  [FONT.price, '600', './assets/fonts/barlow-condensed-600-latin.woff2'],
  [FONT.price, '700', './assets/fonts/barlow-condensed-700-latin.woff2'],
  [FONT.price, '900', './assets/fonts/barlow-condensed-900-latin.woff2'],
  [FONT.text, '400 900', './assets/fonts/noto-sans-arabic-var-latin.woff2'],
];

let assetsPromise = null;

// Canvas silently falls back to a system font if a face is not ready, so fonts are loaded
// explicitly and a failure rejects: a wrong-font price must never be exported.
export function loadRenderAssets() {
  assetsPromise ??= (async () => {
    const faces = FONT_FILES.map(([family, weight, url]) =>
      new FontFace(family, `url(${new URL(url, document.baseURI)})`, { weight, display: 'block' }));
    await Promise.all(faces.map(async (face) => { document.fonts.add(await face.load()); }));
    const logo = new Image();
    logo.src = STORE.logoMark;
    await logo.decode();
    return { logo };
  })().catch((error) => { assetsPromise = null; throw { code: 'font', cause: error }; });
  return assetsPromise;
}

const cssFont = ({ family, weight, size }) => `${weight} ${size}px "${family}"`;

function makeMeasure(ctx) {
  return (text, font) => {
    ctx.font = cssFont(font);
    const m = ctx.measureText(text);
    return { width: m.width, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
  };
}

function roundRect(ctx, { x, y, w, h, r }) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawText(ctx, part, color) {
  ctx.font = cssFont(part.font);
  ctx.fillStyle = color;
  ctx.fillText(part.text, part.x, part.baseline);
}

function drawPhoto(ctx, slot, photo, crop) {
  ctx.save();
  roundRect(ctx, slot);
  ctx.clip();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  if (photo) {
    const pw = photo.naturalWidth ?? photo.width;
    const ph = photo.naturalHeight ?? photo.height;
    const scale = Math.max(slot.w / pw, slot.h / ph) * crop.zoom;
    const w = pw * scale;
    const h = ph * scale;
    // crop.x / crop.y pick which part of the overflow is visible (0.5 = centred).
    ctx.drawImage(photo, slot.x - (w - slot.w) * crop.x, slot.y - (h - slot.h) * crop.y, w, h);
  }
  ctx.restore();
}

function drawPill(ctx, pill, fill, ink, stroke) {
  roundRect(ctx, pill);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    roundRect(ctx, { x: pill.x + 1, y: pill.y + 1, w: pill.w - 2, h: pill.h - 2, r: pill.r - 1 });
    ctx.stroke();
  }
  drawText(ctx, { text: pill.text, font: pill.font, x: pill.textX, baseline: pill.baseline }, ink);
}

export function layoutForItem(ctx, item, colorway) {
  const price = parsePrice(item.fields.price);
  const old = parsePrice(item.fields.oldPrice);
  return computeLayout({
    fields: item.fields,
    priceParts: price.ok ? formatPriceParts(price.ore) : { int: '–', dec: null },
    oldPriceParts: old.ok ? formatPriceParts(old.ore) : null,
    colorway,
    measure: makeMeasure(ctx),
  });
}

export function renderItem(canvas, { item, photo, colorway, assets }) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'ltr';
  ctx.imageSmoothingQuality = 'high';

  const colors = STORE.colorways[colorway];
  const layout = layoutForItem(ctx, item, colorway);

  // Frame: a solid field with the paper inset, so side widths can differ (Grön).
  ctx.fillStyle = colors.frame;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = colors.paper;
  ctx.fillRect(layout.frame.side, layout.frame.top, SIZE - layout.frame.side * 2, SIZE - layout.frame.top * 2);

  drawPhoto(ctx, layout.photo, photo, item.crop);

  const box = layout.logoBox;
  const logoScale = Math.min(box.w / assets.logo.naturalWidth, box.h / assets.logo.naturalHeight);
  const lw = assets.logo.naturalWidth * logoScale;
  const lh = assets.logo.naturalHeight * logoScale;
  ctx.drawImage(assets.logo, box.x, box.y + (box.h - lh) / 2, lw, lh);

  // The shop name is set in type rather than taken from the logo bitmap, so it stays sharp.
  ctx.font = cssFont({ family: FONT.price, weight: 900, size: layout.brand.size });
  let brandX = layout.brand.x;
  for (const [word, color] of STORE.brandWords) {
    ctx.fillStyle = color;
    ctx.fillText(word, brandX, layout.brand.baseline);
    brandX += ctx.measureText(word).width + layout.brand.gap;
  }

  if (layout.tag) drawPill(ctx, layout.tag, colors.tag, colors.tagInk, null);
  if (layout.weight) drawPill(ctx, layout.weight, colors.weight, colors.weightInk, colors.weightStroke);

  // Badge: shadow, fill, inside stroke.
  const badge = layout.badge;
  ctx.save();
  ctx.shadowColor = STORE.shadow;
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, badge);
  ctx.fillStyle = colors.badge;
  ctx.fill();
  ctx.restore();
  const inset = badge.stroke / 2;
  roundRect(ctx, { x: badge.x + inset, y: badge.y + inset, w: badge.w - badge.stroke, h: badge.h - badge.stroke, r: badge.r - inset });
  ctx.lineWidth = badge.stroke;
  ctx.strokeStyle = colors.badgeStroke;
  ctx.stroke();

  const { price } = layout;
  for (const key of ['multi', 'int', 'dec', 'kr', 'unit']) {
    if (price[key]) drawText(ctx, price[key], colors.price);
  }
  if (price.old) {
    drawText(ctx, price.old, colors.price);
    ctx.fillStyle = colors.price;
    const s = price.old.strike;
    ctx.fillRect(s.x1, s.y - s.width / 2, s.x2 - s.x1, s.width);
  }

  if (layout.name) for (const line of layout.name.lines) drawText(ctx, { ...line, font: layout.name.font }, colors.ink);
  if (layout.note) for (const line of layout.note.lines) drawText(ctx, { ...line, font: layout.note.font }, colors.muted);

  return layout;
}
