import { h, icon } from '../dom.js';
import { COLORWAYS, TEMPLATES, itemStatus, moveItem, readyItems, setColorway, setTemplate } from '../../core/batch.js';
import { parsePrice, formatPriceParts } from '../../core/price.js';
import { STORE } from '../../config/store.js';

let reordering = false;

// Miniature diagrams of each template: grey = photo, white = plinth/card, colour = price.
const TEMPLATE_ICON = {
  sockel: '<rect width="48" height="48" rx="6" fill="#B9BDB2"/><rect y="37" width="48" height="11" fill="#fff"/><rect x="27" y="33" width="21" height="15" fill="var(--swatch)"/>',
  kort: '<rect width="48" height="48" rx="6" fill="#B9BDB2"/><rect x="3" y="34" width="42" height="11" rx="3" fill="#fff"/><path d="M27 34h15a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H27z" fill="var(--swatch)"/>',
  signatur: '<rect width="48" height="48" rx="6" fill="#B9BDB2"/><rect y="36" width="48" height="12" fill="var(--swatch)"/><circle cx="24" cy="36" r="6" fill="#fff" stroke="var(--swatch)" stroke-width="1.5"/><rect x="2.5" y="2.5" width="43" height="43" fill="none" stroke="#fff" stroke-width="1"/>',
};

function priceLabel(item) {
  const parsed = parsePrice(item.fields.price);
  if (!parsed.ok) return null;
  const { int, dec } = formatPriceParts(parsed.ore);
  return `${int}${dec ? `,${dec}` : ''} kr${item.fields.unit}`;
}

function thumbCard(app, item, index, total) {
  const { t } = app;
  const status = itemStatus(item);
  const ready = status === 'ready';
  const img = h('img', { class: 'thumb-img', alt: '', decoding: 'async' });
  app.thumbUrl(item.photoKey).then((url) => { if (url) img.src = url; });

  const open = () => { if (!reordering) app.go('editor', { id: item.id }); };

  return h('li', { class: `thumb ${ready ? 'is-ready' : 'is-missing'}` },
    h('button', { class: 'thumb-open', onclick: open, 'aria-label': `${t('editor.position', { n: index + 1, total })} – ${t(`status.${status}`)}` },
      img,
      h('span', { class: 'thumb-status' },
        icon(ready ? 'check' : 'alert', 'thumb-dot'),
        h('span', { class: 'thumb-label', dir: ready ? 'ltr' : null }, ready ? priceLabel(item) : t(`status.${status}`)))),
    reordering
      ? h('div', { class: 'thumb-move' },
        h('button', { class: 'round', disabled: index === 0, 'aria-label': t('batch.moveEarlier'), onclick: () => app.updateBatch((b) => moveItem(b, item.id, index - 1)) }, icon('back', 'icon flip-rtl')),
        h('button', { class: 'round', disabled: index === total - 1, 'aria-label': t('batch.moveLater'), onclick: () => app.updateBatch((b) => moveItem(b, item.id, index + 1)) }, icon('forward', 'icon flip-rtl')))
      : h('button', { class: 'round thumb-remove', 'aria-label': t('batch.remove'), onclick: () => app.removePhoto(item.id) }, icon('close')));
}

export function renderBatch(app) {
  const { t, state } = app;
  const { batch } = state;
  const total = batch.items.length;
  const ready = readyItems(batch).length;
  const missing = total - ready;

  async function generate() {
    if (missing > 0) {
      const choice = await app.sheet({
        title: t('batch.missingWarning', { n: missing }),
        actions: [
          { id: 'fix', label: t('batch.fixFirst'), kind: 'btn-primary' },
          { id: 'go', label: t('batch.continueAnyway') },
        ],
      });
      if (choice === 'fix') {
        const first = batch.items.find((item) => itemStatus(item) !== 'ready');
        app.go('editor', { id: first.id });
        return;
      }
      if (choice !== 'go') return;
    }
    app.go('output');
  }

  const swatches = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': t('batch.colorway') },
    COLORWAYS.map((key) => h('button', {
      class: `swatch ${batch.colorway === key ? 'is-selected' : ''}`,
      role: 'radio',
      'aria-checked': String(batch.colorway === key),
      onclick: () => app.updateBatch((b) => setColorway(b, key)),
    },
    h('span', { class: 'swatch-chip', style: `--swatch:${STORE.colorways[key].swatch}` }, batch.colorway === key ? icon('check') : null),
    h('span', {}, t(`batch.colorway.${key}`)))));

  const swatch = STORE.colorways[batch.colorway].swatch;
  const templates = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': t('batch.template') },
    TEMPLATES.map((key) => h('button', {
      class: `swatch template ${batch.template === key ? 'is-selected' : ''}`,
      role: 'radio',
      'aria-checked': String((batch.template ?? 'sockel') === key),
      onclick: () => app.updateBatch((b) => setTemplate(b, key)),
    },
    h('span', { class: 'template-icon', style: `--swatch:${swatch}`, html: `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">${TEMPLATE_ICON[key]}</svg>` }),
    h('span', {}, t(`batch.template.${key}`)))));

  return h('main', { class: 'screen batch' },
    h('header', { class: 'bar' },
      h('button', { class: 'round', 'aria-label': t('common.back'), onclick: () => { reordering = false; app.go('home'); } }, icon('back', 'icon flip-rtl')),
      h('div', { class: 'bar-title' },
        h('h1', {}, t('batch.title')),
        h('span', { class: 'muted' }, t('batch.ready', { n: ready, total }))),
      total > 1
        ? h('button', { class: 'text-btn', onclick: () => { reordering = !reordering; app.refresh(); } }, t(reordering ? 'editor.done' : 'batch.reorder'))
        : h('span', { class: 'bar-spacer' })),

    h('section', { class: 'section' },
      h('h2', { class: 'label' }, t('batch.template')),
      templates),

    h('section', { class: 'section' },
      h('h2', { class: 'label' }, t('batch.colorway')),
      swatches),

    h('ul', { class: 'thumbs' },
      batch.items.map((item, index) => thumbCard(app, item, index, total)),
      reordering ? null : h('li', { class: 'thumb thumb-add' },
        h('button', { class: 'thumb-add-btn', onclick: app.pickCamera }, icon('camera'), h('span', {}, t('batch.addPhoto'))),
        h('button', { class: 'thumb-add-btn', onclick: app.pickLibrary }, icon('plus'), h('span', {}, t('batch.addPhotos'))))),

    h('footer', { class: 'action-bar' },
      ready === 0 ? h('p', { class: 'hint' }, t('batch.generate.none')) : null,
      h('button', { class: 'btn btn-primary btn-large', disabled: ready === 0, onclick: generate },
        icon('sparkle'), t('batch.generate'), ready > 0 ? h('span', { class: 'count-pill' }, String(ready)) : null)));
}
