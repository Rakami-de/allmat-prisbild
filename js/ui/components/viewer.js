import { h, icon } from '../dom.js';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const SWIPE_NEXT = 60;
const SWIPE_CLOSE = 110;

// Full-screen look at a finished image before saving it: pinch or double-tap to zoom, drag to
// pan, swipe sideways for the next one, swipe down to close. The page itself has zoom disabled
// (it is an app, not a website), so zooming is done here by hand.
export function openViewer({ layer, slides, index = 0, t }) {
  let current = index;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const pointers = new Map();
  let pinch = null;
  let drag = null;
  let lastTap = 0;

  const img = h('img', { class: 'viewer-img', alt: '', draggable: false });
  const stage = h('div', { class: 'viewer-stage' }, img);
  const counter = h('span', { class: 'viewer-counter', dir: 'ltr' });
  const actions = h('div', { class: 'viewer-actions' });
  const prev = h('button', { class: 'round viewer-nav viewer-prev', 'aria-label': t('editor.prev'), onclick: () => go(current - 1) }, icon('back'));
  const next = h('button', { class: 'round viewer-nav viewer-next', 'aria-label': t('editor.next'), onclick: () => go(current + 1) }, icon('forward'));

  const root = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', dir: 'ltr' },
    h('header', { class: 'viewer-bar' },
      h('button', { class: 'round viewer-close', 'aria-label': t('common.close'), onclick: close }, icon('close')),
      counter,
      h('span', { class: 'bar-spacer' })),
    stage, prev, next,
    h('p', { class: 'viewer-hint' }, t('viewer.hint')),
    actions);

  // ---------- transform ----------

  function limits() {
    if (!img.naturalWidth) return { x: 0, y: 0 };   // still loading
    const box = stage.getBoundingClientRect();
    const fit = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const w = img.naturalWidth * fit * scale;
    const height = img.naturalHeight * fit * scale;
    return { x: Math.max(0, (w - box.width) / 2), y: Math.max(0, (height - box.height) / 2) };
  }

  function apply(animate = false) {
    const max = limits();
    tx = Math.min(max.x, Math.max(-max.x, tx));
    ty = Math.min(max.y, Math.max(-max.y, ty));
    img.style.transition = animate ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    root.classList.toggle('is-zoomed', scale > 1.01);
  }

  // Zoom so the point under the fingers stays under the fingers.
  function zoomAt(clientX, clientY, nextScale) {
    const box = stage.getBoundingClientRect();
    const px = clientX - (box.left + box.width / 2);
    const py = clientY - (box.top + box.height / 2);
    const clamped = Math.min(MAX_SCALE, Math.max(1, nextScale));
    const ratio = clamped / scale;
    tx = px - (px - tx) * ratio;
    ty = py - (py - ty) * ratio;
    scale = clamped;
  }

  function reset(animate) { scale = 1; tx = 0; ty = 0; apply(animate); }

  // ---------- slides ----------

  function go(to) {
    if (to < 0 || to >= slides.length) { reset(true); return; }
    current = to;
    const slide = slides[current];
    img.src = slide.url;
    counter.textContent = `${current + 1} / ${slides.length}`;
    prev.hidden = current === 0;
    next.hidden = current === slides.length - 1;
    actions.replaceChildren(...slide.actions(close));
    reset(false);
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    root.classList.add('is-leaving');
    setTimeout(() => root.remove(), 180);
  }

  // ---------- gestures ----------

  stage.addEventListener('pointerdown', (event) => {
    try { stage.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale };
      drag = null;
    } else {
      drag = { x: event.clientX, y: event.clientY, tx, ty, moved: false };
    }
  });

  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance));
      apply();
    } else if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (scale > 1.01) { tx = drag.tx + dx; ty = drag.ty + dy; apply(); }
      // Not zoomed: the picture follows the finger a little, as a hint that it can be flicked.
      else img.style.transform = `translate(${dx * 0.6}px, ${Math.max(0, dy) * 0.6}px)`;
    }
  });

  function release(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size > 0 || !drag) { if (pointers.size === 0) apply(true); return; }

    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const wasTap = !drag.moved;
    drag = null;

    if (wasTap) {
      const now = Date.now();
      if (now - lastTap < DOUBLE_TAP_MS) {
        lastTap = 0;
        if (scale > 1.01) reset(true);
        else { zoomAt(event.clientX, event.clientY, DOUBLE_TAP_SCALE); apply(true); }
      } else lastTap = now;
      return;
    }
    if (scale > 1.01) { apply(true); return; }
    if (dy > SWIPE_CLOSE && Math.abs(dy) > Math.abs(dx)) { close(); return; }
    if (Math.abs(dx) > SWIPE_NEXT && Math.abs(dx) > Math.abs(dy)) { go(current + (dx < 0 ? 1 : -1)); return; }
    apply(true);
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  // Desktop conveniences.
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
    apply();
  }, { passive: false });
  function onKey(event) {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight') go(current + 1);
    if (event.key === 'ArrowLeft') go(current - 1);
  }
  document.addEventListener('keydown', onKey);

  img.addEventListener('load', () => apply(false));
  layer.append(root);
  go(current);
  return close;
}
