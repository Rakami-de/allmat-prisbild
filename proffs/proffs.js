// Proffsbilder — experiment. See README.md in this folder.

const MODELS = {
  fast: {
    id: 'fast', size: 320, keepAspect: true, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], edge: [0.45, 0.82],   // 320 px mask: bite in a little to drop the halo
    url: 'https://huggingface.co/BritishWerewolf/U-2-Netp/resolve/main/onnx/model.onnx',
  },
  fine: {
    id: 'fine', size: 1024, keepAspect: false, mean: [0, 0, 0], std: [1, 1, 1], edge: [0.12, 0.88],
    url: 'https://huggingface.co/onnx-community/ormbg-ONNX/resolve/main/onnx/model_int8.onnx',
  },
};
const MAX_EDGE = 1600;
const BACKDROPS = { rod: '#D10101', gul: '#FFD21F', gron: '#1A6309', svart: '#0E0E0E', vit: '#FFFFFF', rutig: null };

const TEXT = {
  sv: {
    title: 'Proffsbilder', badge: 'Test', back: 'Tillbaka',
    intro: 'Frilägg en vara direkt i telefonen – ingen uppladdning, ingen kostnad. Det här är ett experiment: prova med riktiga bilder från butiken och se om resultatet duger.',
    model: 'Modell', fast: 'Snabb', fastHint: '5 MB · mjukare kanter', fine: 'Noggrann', fineHint: '44 MB · skarpare, tyngre',
    pick: 'Välj bild', shoot: 'Ta foto',
    downloading: 'Hämtar modellen… {p}', starting: 'Startar modellen…', running: 'Frilägger varan…', preparing: 'Läser bilden…',
    backdrop: 'Bakgrund', before: 'Före', after: 'Efter', save: 'Spara PNG', again: 'Ny bild',
    stats: 'Modell: {load} · Friläggning: {run} · Bild: {w}×{h}', cachedModel: 'redan sparad', seconds: '{n} s',
    tip: 'Tips: lägg varan på ett tomt bord eller en vit kartong i dagsljus. Ju renare bakgrund, desto bättre kant.',
    error: 'Det gick inte: {m}', crash: 'Om sidan laddas om av sig själv räckte inte telefonens minne – prova modellen ”Snabb”.',
  },
  ar: {
    title: 'صور احترافية', badge: 'تجربة', back: 'رجوع',
    intro: 'قص المنتج من خلفيته على الجوال نفسه – بدون رفع صور وبدون أي تكلفة. هذه تجربة: جرّب بصور حقيقية من المحل وشوف إذا النتيجة بتمشي.',
    model: 'الموديل', fast: 'سريع', fastHint: '5 ميغا · حواف أنعم', fine: 'دقيق', fineHint: '44 ميغا · أدق وأثقل',
    pick: 'اختر صورة', shoot: 'التقط صورة',
    downloading: 'جاري تحميل الموديل… {p}', starting: 'جاري تشغيل الموديل…', running: 'جاري قص المنتج…', preparing: 'جاري قراءة الصورة…',
    backdrop: 'الخلفية', before: 'قبل', after: 'بعد', save: 'احفظ PNG', again: 'صورة جديدة',
    stats: 'الموديل: {load} · القص: {run} · الصورة: {w}×{h}', cachedModel: 'محفوظ مسبقاً', seconds: '{n} ث',
    tip: 'نصيحة: حط المنتج على طاولة فاضية أو كرتونة بيضا بضوء النهار. كل ما كانت الخلفية أنظف طلعت الحواف أحلى.',
    error: 'ما زبطت: {m}', crash: 'إذا الصفحة أعادت تحميل نفسها فذاكرة الجوال ما كفّت – جرّب الموديل ”سريع“.',
  },
};

const lang = (() => { try { return localStorage.getItem('allmat.lang') === 'ar' ? 'ar' : 'sv'; } catch { return 'sv'; } })();
const t = (key, vars = {}) => TEXT[lang][key].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
document.documentElement.lang = lang;
document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

const $ = (id) => document.getElementById(id);
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
$('back').setAttribute('aria-label', t('back'));

const state = { model: 'fast', backdrop: 'rod', showBefore: false, photo: null, cutout: null };
let worker = null;

// ---------- model picker and backdrops ----------

function paintChoices() {
  for (const button of document.querySelectorAll('[data-model]')) button.classList.toggle('is-selected', button.dataset.model === state.model);
  for (const button of document.querySelectorAll('[data-backdrop]')) button.classList.toggle('is-selected', button.dataset.backdrop === state.backdrop);
  $('compare').textContent = t(state.showBefore ? 'after' : 'before');
}
for (const button of document.querySelectorAll('[data-model]')) {
  button.addEventListener('click', () => { state.model = button.dataset.model; paintChoices(); if (state.photo) run(); });
}
for (const button of document.querySelectorAll('[data-backdrop]')) {
  button.style.setProperty('--swatch', BACKDROPS[button.dataset.backdrop] ?? 'transparent');
  button.addEventListener('click', () => { state.backdrop = button.dataset.backdrop; paintChoices(); drawPreview(); });
}
$('compare').addEventListener('click', () => { state.showBefore = !state.showBefore; paintChoices(); drawPreview(); });

// ---------- photo intake ----------

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

async function onFile(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  setStatus(t('preparing'));
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    state.photo = canvas;
    state.cutout = null;
    run();
  } catch (error) { fail(error); }
}
$('pickInput').addEventListener('change', (e) => onFile(e.target));
$('shootInput').addEventListener('change', (e) => onFile(e.target));
$('pick').addEventListener('click', () => $('pickInput').click());
$('shoot').addEventListener('click', () => $('shootInput').click());
$('again').addEventListener('click', () => $('pickInput').click());

// ---------- inference ----------

function preprocess(photo, model) {
  const S = model.size;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let w = S;
  let h = S;
  if (model.keepAspect) {
    const k = S / Math.max(photo.width, photo.height);
    w = Math.round(photo.width * k);
    h = Math.round(photo.height * k);
  }
  ctx.drawImage(photo, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, S, S);
  const input = new Float32Array(3 * S * S);   // padding stays 0, i.e. the mean colour
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * S + x;
      for (let c = 0; c < 3; c += 1) input[c * S * S + p] = (data[p * 4 + c] / 255 - model.mean[c]) / model.std[c];
    }
  }
  return { input, w, h };
}

function run() {
  const model = MODELS[state.model];
  document.body.classList.add('is-busy');
  $('result').hidden = true;
  const { input, w, h } = preprocess(state.photo, model);

  worker ??= new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onerror = (event) => fail(new Error(event.message || 'worker'));
  worker.onmessage = ({ data }) => {
    if (data.type === 'download') setStatus(t('downloading', { p: data.total ? `${Math.round((data.received / data.total) * 100)} %` : `${(data.received / 1e6).toFixed(1)} MB` }), data.total ? data.received / data.total : null);
    else if (data.type === 'status') setStatus(t(data.status));
    else if (data.type === 'error') fail(new Error(data.message));
    else if (data.type === 'done') finish(data, model, w, h);
  };
  setStatus(t('starting'));
  worker.postMessage({ type: 'run', model: { id: model.id, url: model.url }, input, size: model.size }, [input.buffer]);
}

const smoothstep = (lo, hi, v) => { const x = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return x * x * (3 - 2 * x); };

function finish({ mask, loadMs, runMs, cached }, model, w, h) {
  const S = model.size;
  const photo = state.photo;

  // Mask → small alpha image → scaled up to the photo with smoothing.
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const sctx = small.getContext('2d');
  const smallData = sctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const a = Math.round(mask[y * S + x] * 255);
      const p = (y * w + x) * 4;
      smallData.data[p] = a; smallData.data[p + 1] = a; smallData.data[p + 2] = a; smallData.data[p + 3] = 255;
    }
  }
  sctx.putImageData(smallData, 0, 0);

  const big = document.createElement('canvas');
  big.width = photo.width; big.height = photo.height;
  const bctx = big.getContext('2d', { willReadFrequently: true });
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, big.width, big.height);
  const alpha = bctx.getImageData(0, 0, big.width, big.height).data;

  const out = document.createElement('canvas');
  out.width = photo.width; out.height = photo.height;
  const octx = out.getContext('2d', { willReadFrequently: true });
  octx.drawImage(photo, 0, 0);
  const pixels = octx.getImageData(0, 0, out.width, out.height);
  // A levels curve: clears the faint haze the models leave and firms up the edge.
  let x0 = out.width, y0 = out.height, x1 = 0, y1 = 0;
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const p = (y * out.width + x) * 4;
      const a = Math.round(smoothstep(model.edge[0], model.edge[1], alpha[p] / 255) * 255);
      pixels.data[p + 3] = a;
      if (a > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  octx.putImageData(pixels, 0, 0);

  // Crop to the product, with a little air, so the PNG is ready to place on a flyer.
  if (x1 > x0 && y1 > y0) {
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(out.width - 1, x1 + pad); y1 = Math.min(out.height - 1, y1 + pad);
    const cropped = document.createElement('canvas');
    cropped.width = x1 - x0 + 1; cropped.height = y1 - y0 + 1;
    cropped.getContext('2d').drawImage(out, x0, y0, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    state.cutout = cropped;
  } else state.cutout = out;

  const sec = (ms) => t('seconds', { n: (ms / 1000).toFixed(1).replace('.', ',') });
  $('stats').textContent = t('stats', { load: loadMs === 0 || cached ? `${t('cachedModel')}${loadMs ? ` (${sec(loadMs)})` : ''}` : sec(loadMs), run: sec(runMs), w: photo.width, h: photo.height });
  document.body.classList.remove('is-busy');
  $('result').hidden = false;
  state.showBefore = false;
  paintChoices();
  drawPreview();
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- preview ----------

function drawPreview() {
  if (!state.cutout) return;
  const canvas = $('preview');
  const size = 1080;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const color = BACKDROPS[state.backdrop];
  if (color) { ctx.fillStyle = color; ctx.fillRect(0, 0, size, size); } else {
    for (let y = 0; y < size; y += 40) for (let x = 0; x < size; x += 40) { ctx.fillStyle = ((x + y) / 40) % 2 ? '#DADAD5' : '#F4F4F1'; ctx.fillRect(x, y, 40, 40); }
  }
  const source = state.showBefore ? state.photo : state.cutout;
  const k = Math.min((size * 0.84) / source.width, (size * 0.84) / source.height);
  const w = source.width * k;
  const h = source.height * k;
  ctx.save();
  if (!state.showBefore) { ctx.shadowColor = '#00000059'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26; }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
  ctx.restore();
}

// ---------- save ----------

$('save').addEventListener('click', async () => {
  const blob = await new Promise((resolve) => state.cutout.toBlob(resolve, 'image/png'));
  const file = new File([blob], `allmat-frilagd-${Date.now()}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch { /* dismissed */ }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
});

// ---------- status ----------

function setStatus(text, fraction = null) {
  $('statusText').textContent = text;
  $('statusBar').style.inlineSize = fraction === null ? '100%' : `${Math.round(fraction * 100)}%`;
  $('statusBar').classList.toggle('is-indeterminate', fraction === null);
}

function fail(error) {
  document.body.classList.remove('is-busy');
  $('statusText').textContent = t('error', { m: error.message });
  document.body.classList.add('has-error');
  setTimeout(() => document.body.classList.remove('has-error'), 6000);
}

paintChoices();
document.body.classList.add('is-ready');
