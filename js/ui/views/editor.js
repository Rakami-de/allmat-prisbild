import { h, icon } from '../dom.js';
import { UNITS, MODES, itemStatus, updateFields, updateCrop } from '../../core/batch.js';
import { parsePrice, formatPriceParts } from '../../core/price.js';
import { loadImage, releaseCanvas } from '../../core/photo.js';
import { loadRenderAssets, renderItem } from '../../core/render.js';
import { getPhoto } from '../../core/storage.js';
import { SIZE, GEOMETRY } from '../../core/layout.js';

const tidyPrice = (text) => {
  const parsed = parsePrice(text);
  if (!parsed.ok) return text;
  const { int, dec } = formatPriceParts(parsed.ore);
  return `${int.replace(/ /g, ' ')}${dec ? `,${dec}` : ''}`;
};

export function renderEditor(app, { id }) {
  const { t, state } = app;
  const items = () => state.batch.items;
  const current = () => items().find((item) => item.id === id);
  if (!current()) { queueMicrotask(() => app.go('batch')); return h('main', { class: 'screen' }); }

  const index = items().findIndex((item) => item.id === id);
  const total = items().length;
  const canvas = h('canvas', { class: 'preview-canvas', width: SIZE, height: SIZE, 'aria-label': t('editor.photoHint') });
  let photo = null;
  let assets = null;
  let frame = 0;
  let alive = true;

  // ---------- live preview ----------

  const hintEl = h('p', { class: 'field-hint', role: 'status' });
  const WARNING_KEYS = { 'price-overflow': 'status.invalid-price', 'name-overflow': 'editor.warn.name', 'note-overflow': 'editor.warn.note', 'weight-overflow': 'editor.warn.weight' };

  function draw() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!alive || !assets) return;
      const item = current();
      const layout = renderItem(canvas, { item, photo, colorway: state.batch.colorway, assets });
      const status = itemStatus(item);
      const problem = status === 'invalid-price' || status === 'invalid-old-price'
        ? t(`status.${status}`)
        : layout.warnings.map((w) => t(WARNING_KEYS[w])).join(' · ');
      hintEl.textContent = item.fields.price.trim() === '' ? '' : problem;
      hintEl.classList.toggle('is-visible', hintEl.textContent !== '');
    });
  }

  (async () => {
    try {
      assets = await loadRenderAssets();
      draw();
      const blob = await getPhoto(current().photoKey);
      if (!alive) return;
      photo = await loadImage(blob);
      draw();
    } catch (error) { app.fail(error); }
  })();

  const setFields = (patch) => { app.updateBatch((b) => updateFields(b, id, patch), { repaint: false }); draw(); };

  // ---------- pan & pinch on the photo only ----------

  const pointers = new Map();
  let pinchStart = null;

  function overflow() {
    const slot = GEOMETRY.photo;
    const { zoom } = current().crop;
    const scale = Math.max(slot.w / photo.naturalWidth, slot.h / photo.naturalHeight) * zoom;
    return { x: photo.naturalWidth * scale - slot.w, y: photo.naturalHeight * scale - slot.h };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!photo) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: current().crop.zoom };
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous || !photo) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const toCanvas = SIZE / canvas.clientWidth;

    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const zoom = pinchStart.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.distance);
      app.updateBatch((batch) => updateCrop(batch, id, { zoom }), { repaint: false });
    } else if (pointers.size === 1) {
      const over = overflow();
      const { x, y } = current().crop;
      app.updateBatch((batch) => updateCrop(batch, id, {
        x: over.x > 0 ? x - ((event.clientX - previous.x) * toCanvas) / over.x : x,
        y: over.y > 0 ? y - ((event.clientY - previous.y) * toCanvas) / over.y : y,
      }), { repaint: false });
    }
    draw();
  });

  const release = (event) => { pointers.delete(event.pointerId); if (pointers.size < 2) pinchStart = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---------- fields ----------

  const fields = current().fields;

  const priceInput = h('input', {
    class: 'price-input', id: 'price', type: 'text', inputmode: 'decimal', dir: 'ltr', autocomplete: 'off',
    enterkeyhint: 'done', placeholder: t('editor.pricePlaceholder'), value: fields.price,
    oninput: (e) => setFields({ price: e.target.value }),
    onblur: (e) => { const tidy = tidyPrice(e.target.value); if (tidy !== e.target.value) { e.target.value = tidy; setFields({ price: tidy }); } },
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });

  function chipGroup(labelKey, options, selected, onPick, labelFor) {
    const group = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': t(labelKey) });
    const paintChips = (value) => group.replaceChildren(...options.map((option) => h('button', {
      class: `chip ${option === value ? 'is-selected' : ''}`, role: 'radio', 'aria-checked': String(option === value),
      onclick: () => { onPick(option); paintChips(option); },
    }, option === value ? icon('check', 'chip-check') : null, h('span', { dir: option ? 'ltr' : null }, labelFor(option)))));
    paintChips(selected);
    return group;
  }

  const oldPriceRow = h('div', { class: 'field', hidden: fields.mode !== 'kampanj' },
    h('label', { for: 'oldPrice' }, t('editor.oldPrice')),
    h('input', {
      id: 'oldPrice', class: 'input', type: 'text', inputmode: 'decimal', dir: 'ltr', autocomplete: 'off', value: fields.oldPrice,
      placeholder: '39,95', oninput: (e) => setFields({ oldPrice: e.target.value }),
      onblur: (e) => { e.target.value = tidyPrice(e.target.value); setFields({ oldPrice: e.target.value }); },
    }));

  const modeControl = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t('editor.mode') });
  const paintModes = (value) => modeControl.replaceChildren(...MODES.map((mode) => h('button', {
    class: `segment ${mode === value ? 'is-selected' : ''}`, role: 'radio', 'aria-checked': String(mode === value),
    onclick: () => { setFields({ mode }); oldPriceRow.hidden = mode !== 'kampanj'; paintModes(mode); },
  }, t(`editor.mode.${mode}`))));
  paintModes(fields.mode);

  const textField = (key, labelKey, placeholderKey, extra = {}) => h('div', { class: 'field' },
    h('label', { for: key }, t(labelKey)),
    h('input', {
      id: key, class: 'input', type: 'text', dir: 'auto', autocomplete: 'off', autocapitalize: 'sentences', lang: 'sv',
      value: fields[key], placeholder: t(placeholderKey), oninput: (e) => setFields({ [key]: e.target.value }), ...extra,
    }));

  const hasExtras = Boolean(fields.name || fields.weight || fields.note || fields.multiQty);
  const more = h('details', { class: 'more', open: hasExtras },
    h('summary', {}, h('span', {}, t('editor.more')), icon('chevron', 'icon more-chevron')),
    textField('name', 'editor.name', 'editor.namePlaceholder', { maxLength: 60 }),
    textField('weight', 'editor.weight', 'editor.weightPlaceholder', { maxLength: 16, dir: 'ltr' }),
    textField('note', 'editor.note', 'editor.notePlaceholder', { maxLength: 80 }),
    h('div', { class: 'field' },
      h('label', { for: 'multiQty' }, t('editor.multiQty')),
      h('input', {
        id: 'multiQty', class: 'input', type: 'text', inputmode: 'numeric', dir: 'ltr', maxLength: 2, value: fields.multiQty,
        placeholder: t('editor.multiQtyPlaceholder'), oninput: (e) => setFields({ multiQty: e.target.value }),
      }),
      h('p', { class: 'muted small' }, t('editor.multiHint'))));

  // ---------- chrome ----------

  const saved = h('span', { class: 'saved', 'aria-live': 'polite' }, icon('check', 'saved-icon'), t('editor.saved'));
  let savedTimer = 0;
  const onSaved = () => { saved.classList.add('is-visible'); clearTimeout(savedTimer); savedTimer = setTimeout(() => saved.classList.remove('is-visible'), 1400); };
  document.addEventListener('allmat:saved', onSaved);

  const goTo = (offset) => app.go('editor', { id: items()[index + offset].id });
  const isLast = index === total - 1;

  const el = h('main', { class: 'screen editor' },
    h('header', { class: 'bar' },
      h('button', { class: 'round', 'aria-label': t('common.back'), onclick: () => app.go('batch') }, icon('back', 'icon flip-rtl')),
      h('div', { class: 'bar-title' }, h('h1', {}, t('editor.position', { n: index + 1, total }))),
      saved),
    h('div', { class: 'preview' }, canvas, h('p', { class: 'muted small preview-hint' }, t('editor.photoHint'))),
    h('section', { class: 'form' },
      h('div', { class: 'field' },
        h('label', { for: 'price' }, t('editor.price')),
        h('div', { class: 'price-row', dir: 'ltr' }, priceInput, h('span', { class: 'price-suffix' }, 'kr')),
        hintEl),
      h('div', { class: 'field' },
        h('span', { class: 'label' }, t('editor.unit')),
        chipGroup('editor.unit', UNITS, fields.unit, (unit) => setFields({ unit }), (unit) => unit || t('editor.unit.none'))),
      h('div', { class: 'field' }, h('span', { class: 'label' }, t('editor.mode')), modeControl),
      oldPriceRow,
      more),
    h('footer', { class: 'action-bar action-bar-split' },
      h('button', { class: 'btn btn-secondary', disabled: index === 0, onclick: () => goTo(-1) }, icon('back', 'icon flip-rtl'), t('editor.prev')),
      h('button', { class: 'btn btn-primary', onclick: () => (isLast ? app.go('batch') : goTo(1)) },
        t(isLast ? 'editor.done' : 'editor.next'), isLast ? icon('check') : icon('forward', 'icon flip-rtl'))));

  if (!fields.price) setTimeout(() => { if (alive && matchMedia('(pointer: fine)').matches) priceInput.focus(); }, 300);

  return {
    el,
    destroy() {
      alive = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('allmat:saved', onSaved);
      if (photo) photo.src = '';
      releaseCanvas(canvas);
    },
  };
}
