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
    const logo = await loadUrl(STORE.logoMark);
    return { logo };
  })().catch((error) => { assetsPromise = null; throw { code: 'font', cause: error }; });
  return assetsPromise;
}

function loadUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
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
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.w, slot.h);
  ctx.clip();
  ctx.fillStyle = '#E9E9E4';
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

function drawShape(ctx, shape, colors) {
  const color = colors[shape.fill];
  ctx.save();
  if (shape.shadow) {
    ctx.shadowColor = STORE.shadow;
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 16;
  }
  ctx.beginPath();
  if (shape.type === 'circle') ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
  else if (shape.type === 'roundRect') ctx.roundRect(shape.x, shape.y, shape.w, shape.h, shape.r);
  else ctx.rect(shape.x, shape.y, shape.w, shape.h);
  if (shape.type === 'strokeRect') {
    ctx.lineWidth = shape.line;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

function drawPill(ctx, pill, fill, ink) {
  ctx.save();
  ctx.shadowColor = '#0000002E';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, pill);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  drawText(ctx, { text: pill.text, font: pill.font, x: pill.textX, baseline: pill.baseline }, ink);
}

export function layoutForItem(ctx, item, template) {
  const price = parsePrice(item.fields.price);
  const old = parsePrice(item.fields.oldPrice);
  return computeLayout({
    fields: item.fields,
    priceParts: price.ok ? formatPriceParts(price.ore) : { int: '–', dec: null },
    oldPriceParts: old.ok ? formatPriceParts(old.ore) : null,
    template,
    storeName: STORE.name,
    measure: makeMeasure(ctx),
  });
}

export function renderItem(canvas, { item, photo, colorway, template, assets }) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'ltr';
  ctx.imageSmoothingQuality = 'high';

  const colors = STORE.colorways[colorway] ?? STORE.colorways.rod;
  const layout = layoutForItem(ctx, item, template);

  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, SIZE, SIZE);
  drawPhoto(ctx, layout.photo, photo, item.crop);
  for (const shape of layout.shapes) drawShape(ctx, shape, colors);

  const box = layout.logo;
  const logoScale = Math.min(box.w / assets.logo.naturalWidth, box.h / assets.logo.naturalHeight);
  const lw = assets.logo.naturalWidth * logoScale;
  const lh = assets.logo.naturalHeight * logoScale;
  ctx.drawImage(assets.logo, box.x + (box.w - lw) / 2, box.y + (box.h - lh) / 2, lw, lh);

  // The shop name is set in type rather than taken from the logo bitmap, so it stays sharp.
  if (layout.brand) {
    ctx.font = cssFont({ family: FONT.price, weight: 900, size: layout.brand.size });
    const gap = layout.brand.size * 0.22;
    const total = STORE.brandWords.reduce((sum, [word]) => sum + ctx.measureText(word).width, 0) + gap * (STORE.brandWords.length - 1);
    let brandX = layout.brand.cx === undefined ? layout.brand.x : layout.brand.cx - total / 2;
    for (const [word, color] of STORE.brandWords) {
      ctx.fillStyle = color;
      ctx.fillText(word, brandX, layout.brand.baseline);
      brandX += ctx.measureText(word).width + gap;
    }
  }

  if (layout.tag) drawPill(ctx, layout.tag, colors.block, colors.on);
  if (layout.weight) drawPill(ctx, layout.weight, colors.paper, colors.ink);

  const { price } = layout;
  const priceColor = colors[price.color];
  for (const key of ['multi', 'int', 'dec', 'kr']) {
    if (price[key]) drawText(ctx, price[key], priceColor);
  }
  if (price.old) {
    ctx.globalAlpha = 0.85;
    drawText(ctx, price.old, priceColor);
    const s = price.old.strike;
    ctx.fillRect(s.x1, s.y - s.width / 2, s.x2 - s.x1, s.width);
    ctx.globalAlpha = 1;
  }

  if (layout.name) drawText(ctx, layout.name, colors[layout.name.color]);
  if (layout.note) drawText(ctx, layout.note, colors[layout.note.color]);

  return layout;
}
