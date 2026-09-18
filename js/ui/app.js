import { createI18n, DEFAULT_LANG } from '../i18n/index.js';
import { createBatch, addItem, removeItem } from '../core/batch.js';
import { decodePhoto } from '../core/photo.js';
import { loadRenderAssets } from '../core/render.js';
import * as storage from '../core/storage.js';
import { h, icon } from './dom.js';
import { renderHome } from './views/home.js';
import { renderBatch } from './views/batch.js';
import { renderEditor } from './views/editor.js';
import { renderOutput } from './views/output.js';

const VIEWS = { home: renderHome, batch: renderBatch, editor: renderEditor, output: renderOutput };
const ORDER = ['home', 'batch', 'editor', 'output'];
const LANG_KEY = 'allmat.lang';
const SAVE_DELAY = 300;

const root = document.getElementById('view');
const layer = document.getElementById('layer');
const cameraInput = document.getElementById('cameraInput');
const libraryInput = document.getElementById('libraryInput');

const readLang = () => { try { return localStorage.getItem(LANG_KEY); } catch { return null; } };

const state = {
  i18n: createI18n(readLang() ?? DEFAULT_LANG),
  batch: createBatch(),
  view: 'home',
  params: {},
};
const thumbUrls = new Map();
let cleanup = null;
let saveTimer = null;

// ---------- app API handed to views ----------

export const app = {
  state,
  t: (key, vars) => state.i18n.t(key, vars),

  go(view, params = {}) {
    const backwards = ORDER.indexOf(view) < ORDER.indexOf(state.view);
    state.view = view;
    state.params = params;
    paint(backwards ? 'back' : 'forward');
  },

  refresh() { paint('none'); },

  setLang(lang) {
    state.i18n = createI18n(lang);
    try { localStorage.setItem(LANG_KEY, state.i18n.lang); } catch { /* private mode */ }
    applyLang();
    paint('none');
  },

  // Every batch change goes through here so it is always persisted.
  updateBatch(fn, { repaint = true } = {}) {
    state.batch = fn(state.batch);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_DELAY);
    if (repaint) paint('none');
  },

  async removePhoto(id) {
    const item = state.batch.items.find((entry) => entry.id === id);
    if (!item) return;
    app.updateBatch((batch) => removeItem(batch, id));
    releaseThumb(item.photoKey);
    await Promise.allSettled([storage.deletePhoto(item.photoKey), storage.deletePhoto(`${item.photoKey}:t`)]);
    if (state.batch.items.length === 0) app.go('home');
  },

  async discardBatch() {
    for (const key of [...thumbUrls.keys()]) releaseThumb(key);
    state.batch = createBatch();
    clearTimeout(saveTimer);
    await storage.clearAll().catch(() => {});
  },

  pickCamera: () => cameraInput.click(),
  pickLibrary: () => libraryInput.click(),

  // Caches the pending read, so repaints never create a second object URL for the same photo.
  thumbUrl(photoKey) {
    if (!thumbUrls.has(photoKey)) {
      thumbUrls.set(photoKey, storage.getPhoto(`${photoKey}:t`).then((blob) => (blob ? URL.createObjectURL(blob) : null)));
    }
    return thumbUrls.get(photoKey);
  },

  toast(message, { sticky = false } = {}) {
    const el = h('div', { class: 'toast', role: 'status' }, message);
    layer.querySelector('.toast')?.remove();
    layer.append(el);
    if (!sticky) setTimeout(() => el.remove(), 2600);
    return () => el.remove();
  },

  fail(error) {
    const key = { quota: 'error.quota', photo: 'error.photo', font: 'error.font', share: 'error.share' }[error?.code];
    if (!key) console.error(error);
    app.toast(app.t(key ?? 'error.photo'));
  },

  // Native-feeling bottom sheet; resolves with the chosen action id (or null when dismissed).
  sheet({ title, body, actions }) {
    if (layer.querySelector('.sheet-wrap')) return Promise.resolve(null);   // a double tap must not stack sheets
    return new Promise((resolve) => {
      const close = (value) => {
        wrap.classList.add('is-leaving');
        setTimeout(() => { wrap.remove(); resolve(value); }, 220);
      };
      const wrap = h('div', { class: 'sheet-wrap' },
        h('div', { class: 'scrim', onclick: () => close(null) }),
        h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h('div', { class: 'sheet-grabber' }),
          h('h2', { class: 'sheet-title' }, title),
          body ? h('p', { class: 'sheet-body' }, body) : null,
          h('div', { class: 'sheet-actions' }, actions.map((action) =>
            h('button', { class: `btn ${action.kind ?? 'btn-secondary'}`, onclick: () => close(action.id) }, action.label))),
        ));
      layer.append(wrap);
    });
  },
};

// ---------- persistence ----------

async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    await storage.saveBatch(state.batch);
    document.dispatchEvent(new CustomEvent('allmat:saved'));
  } catch (error) { app.fail(error); }
}

// iOS may kill a backgrounded PWA without warning: never leave an edit waiting on the debounce.
const flushIfPending = () => { if (saveTimer) flushSave(); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushIfPending(); });
addEventListener('pagehide', flushIfPending);

// ---------- painting ----------

function applyLang() {
  document.documentElement.lang = state.i18n.lang;
  document.documentElement.dir = state.i18n.dir;
}

function paint(direction) {
  const swap = () => {
    cleanup?.();
    cleanup = null;
    const result = VIEWS[state.view](app, state.params);
    const el = result.el ?? result;
    cleanup = result.destroy ?? null;
    // A refresh of the same screen (new colour, removed photo, reorder) must keep the user's
    // place; only a real navigation starts from the top.
    const keep = direction === 'none' ? root.scrollTop : 0;
    root.replaceChildren(el);
    root.scrollTop = keep;
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (direction === 'none' || reduced || !document.startViewTransition) { swap(); return; }
  document.documentElement.dataset.nav = direction;
  // A transition can be skipped (hidden tab, rapid taps); the swap itself still runs.
  const transition = document.startViewTransition(swap);
  transition.ready.catch(() => {});
  transition.updateCallbackDone.catch(() => {});
  transition.finished.catch(() => {});
}

function releaseThumb(photoKey) {
  const pending = thumbUrls.get(photoKey);
  thumbUrls.delete(photoKey);
  pending?.then((url) => { if (url) URL.revokeObjectURL(url); });
}

// ---------- photo intake ----------

async function addFiles(files) {
  const startedOn = state.view;
  let dismiss = null;
  let failed = 0;
  for (const [index, file] of files.entries()) {
    dismiss?.();
    dismiss = app.toast(`${index + 1} / ${files.length}`, { sticky: true });
    try {
      const { blob, thumb } = await decodePhoto(file);
      const id = crypto.randomUUID();
      await storage.addPhoto(id, blob, thumb, addItem(state.batch, { id, photoKey: id }));
      // Re-apply on the live state: the user may have edited something while the write ran.
      app.updateBatch((batch) => addItem(batch, { id, photoKey: id }), { repaint: state.view === 'batch' });
    } catch (error) {
      if (error?.code === 'quota') { dismiss?.(); app.fail(error); break; }
      failed += 1;
    }
  }
  dismiss?.();
  if (failed > 0) app.toast(app.t('error.photo'));
  // Only leave Home automatically; never pull the user out of an editor or an export.
  if (startedOn === 'home' && state.view === 'home' && state.batch.items.length > 0) app.go('batch');
}

// One intake at a time: a second pick waits for the first instead of racing it.
let intake = Promise.resolve();

for (const input of [cameraInput, libraryInput]) {
  input.addEventListener('change', () => {
    const files = [...input.files].filter((file) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name));
    input.value = '';
    if (files.length > 0) intake = intake.then(() => addFiles(files)).catch((error) => app.fail(error));
  });
}

// ---------- service worker ----------

function watchForUpdates() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost') return;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((registration) => {
    const offer = (worker) => {
      const banner = h('div', { class: 'update-banner' },
        h('span', {}, app.t('update.available')),
        h('button', { class: 'btn btn-small btn-primary', onclick: () => worker.postMessage('skip-waiting') }, app.t('update.apply')));
      layer.append(banner);
    };
    if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
  }).catch(() => {});
  // The very first install also fires controllerchange (clients.claim); reloading then would
  // interrupt someone who has already started picking photos. Only reload for real updates.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    location.reload();
  });
}

// ---------- keyboard ----------
// The view is a fixed scroll container, so it has to shrink with the on-screen keyboard
// or lower fields end up underneath it.

function trackKeyboard() {
  const viewport = window.visualViewport;
  if (!viewport) return;

  // iOS also pans the whole page when the keyboard opens, even though only #view scrolls.
  // Pin the page back and let the view, sized to the visible area, do the scrolling.
  const apply = () => {
    document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
  };
  viewport.addEventListener('resize', apply);
  viewport.addEventListener('scroll', apply);
  apply();

  // Nudge a focused field into view only when the keyboard really covers it, by exactly the
  // amount needed. An unconditional scrollIntoView fights Safari's own scroll and makes the
  // screen lurch.
  document.addEventListener('focusin', (event) => {
    const field = event.target;
    if (!field.matches?.('input')) return;
    setTimeout(() => {
      if (document.activeElement !== field) return;
      const rect = field.getBoundingClientRect();
      const footer = root.querySelector('.action-bar')?.offsetHeight ?? 0;
      const visibleBottom = viewport.height - footer - 16;
      if (rect.bottom > visibleBottom) root.scrollBy({ top: rect.bottom - visibleBottom, behavior: 'smooth' });
      else if (rect.top < 72) root.scrollBy({ top: rect.top - 72, behavior: 'smooth' });
    }, 350);
  });
  document.addEventListener('focusout', () => setTimeout(apply, 50));
}

// ---------- boot ----------

async function boot() {
  applyLang();
  trackKeyboard();
  try {
    await storage.openStore();   // keeps the handle warm so later saves start synchronously
    const saved = await storage.loadBatch();
    if (saved?.items?.length) state.batch = { ...createBatch(), ...saved };
  } catch { /* storage unavailable: start empty */ }
  state.params = { resume: state.batch.items.length > 0 };
  paint('none');
  document.body.classList.add('is-ready');
  storage.requestPersistence();
  loadRenderAssets().catch(() => app.toast(app.t('error.font')));
  watchForUpdates();
}

boot();
