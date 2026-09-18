import { h, icon } from '../dom.js';
import { generateAll, canShareFiles, shareFiles } from '../../core/export.js';
import { readyItems } from '../../core/batch.js';
import { planPages } from '../../core/collage.js';
import { openViewer } from '../components/viewer.js';

export function renderOutput(app) {
  const { t, state } = app;
  const controller = new AbortController();
  const urls = [];
  let closeViewer = null;
  const el = h('main', { class: 'screen output' });

  // ---------- phase 1: prepare ----------

  const bar = h('div', { class: 'progress-fill' });
  const label = h('p', { class: 'progress-label', role: 'status' });
  el.append(
    h('div', { class: 'progress-screen' },
      h('div', { class: 'progress-ring' }, icon('sparkle')),
      label,
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar),
      h('button', { class: 'btn btn-secondary', onclick: () => { controller.abort(); app.go('batch'); } }, t('output.cancel'))));

  generateAll(state.batch, {
    signal: controller.signal,
    onProgress(done, total) {
      label.textContent = t('output.preparing', { n: Math.min(done + 1, total), total });
      bar.style.inlineSize = `${Math.round((done / total) * 100)}%`;
    },
  }).then(showResults, (error) => {
    if (error?.code === 'cancelled') return;
    app.fail(error);
    app.go('batch');
  });

  // ---------- phase 2: hand over ----------
  // Sharing happens on its own tap, after all files exist: Safari only allows
  // navigator.share() directly inside a user gesture.

  function showResults(files) {
    if (controller.signal.aborted) return;
    // A 15-file payload can be refused while single files are fine, so check each case on its own.
    const canShareAll = canShareFiles(files);
    const n = files.length;

    const share = async (list) => {
      try { await shareFiles(list); } catch (error) { app.fail(error); }
    };

    // Which product to open when the user wants to change an image. A Lista sheet holds many
    // products, so it opens the first one on that sheet.
    const items = readyItems(state.batch);
    const pages = state.batch.template === 'lista' ? planPages(items.length) : null;
    const editIdFor = (index) => (pages ? items[pages[index].start] : items[index])?.id;
    const edit = (index) => app.go('editor', { id: editIdFor(index), from: 'output' });

    const slides = files.map((file, index) => {
      const url = URL.createObjectURL(file);
      urls.push(url);
      const shareable = canShareFiles([file]);
      return {
        url, file, shareable,
        actions: (close) => [
          h('button', { class: 'btn btn-secondary', onclick: () => { close(); edit(index); } }, icon('edit'), t('viewer.edit')),
          shareable
            ? h('button', { class: 'btn btn-primary', onclick: () => share([file]) }, icon('save'), t('viewer.save'))
            : h('a', { class: 'btn btn-primary', href: url, download: file.name }, icon('save'), t('output.download')),
        ],
      };
    });

    const grid = h('ul', { class: 'results' }, slides.map((slide, index) =>
      h('li', { class: 'result' },
        h('button', {
          class: 'result-open', 'aria-label': t('viewer.open'),
          onclick: () => { closeViewer = openViewer({ layer: document.getElementById('layer'), slides, index, t }); },
        }, h('img', { src: slide.url, alt: slide.file.name, loading: 'lazy', decoding: 'async' }), h('span', { class: 'result-zoom' }, icon('zoom'))),
        slide.shareable
          ? h('button', { class: 'round result-share', 'aria-label': t('output.share'), onclick: () => share([slide.file]) }, icon('share'))
          : h('a', { class: 'round result-share', href: slide.url, download: slide.file.name, 'aria-label': t('output.download') }, icon('save')))));

    const canShareOne = files.length > 0 && canShareFiles([files[0]]);
    const actions = canShareAll
      ? [
        h('button', { class: 'btn btn-primary btn-large', onclick: () => share(files) }, icon('save'), t('output.save')),
        h('p', { class: 'hint' }, t('output.saveHint', { n })),
        h('button', { class: 'btn btn-secondary btn-large', onclick: () => share(files) }, icon('share'), t('output.share')),
      ]
      : [h('p', { class: 'hint' }, t(canShareOne ? 'output.oneByOneHint' : 'error.share'))];

    el.replaceChildren(
      h('header', { class: 'bar' },
        h('button', { class: 'round', 'aria-label': t('output.back'), onclick: () => app.go('batch') }, icon('back', 'icon flip-rtl')),
        h('div', { class: 'bar-title' }, h('h1', {}, t('output.title')), h('span', { class: 'muted' }, t('output.count', { n }))),
        h('span', { class: 'bar-spacer' })),
      grid,
      h('footer', { class: 'action-bar' },
        ...actions,
        h('div', { class: 'footer-links' },
          h('button', { class: 'text-btn', onclick: () => app.go('batch') }, icon('edit'), t('output.edit')),
          h('button', {
            class: 'text-btn',
            onclick: async () => {
              const choice = await app.sheet({
                title: t('output.newBatch'),
                body: t('output.newBatchConfirm'),
                actions: [{ id: 'yes', label: t('output.newBatch'), kind: 'btn-danger' }, { id: 'no', label: t('common.no') }],
              });
              if (choice === 'yes') { await app.discardBatch(); app.go('home'); }
            },
          }, t('output.newBatch')))));
  }

  return {
    el,
    destroy() {
      controller.abort();
      closeViewer?.();
      urls.forEach((url) => URL.revokeObjectURL(url));
    },
  };
}
