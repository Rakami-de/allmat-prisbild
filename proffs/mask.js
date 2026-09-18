// Cleans a raw segmentation mask. The models return a soft 0…1 map that, on real shop photos,
// has three typical faults: a faint haze over the background, stray fragments of other objects,
// and "washed-out" patches inside the product where the model was unsure. All three are fixed
// here with plain image morphology — no second model.

const KEEP_RATIO = 0.2;   // a second object is kept only if it is at least this share of the largest
const CLOSE = 5;          // seals gaps this wide so an unsure patch touching the outline still counts as inside
const EDGE_BAND = 3;      // pixels (at mask resolution) that stay soft for anti-aliasing

const smoothstep = (lo, hi, v) => { const x = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return x * x * (3 - 2 * x); };

// Labels 4-connected regions of `on`; returns labels (0 = none) and each label's area.
function components(on, w, h) {
  const labels = new Int32Array(w * h);
  const areas = [0];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start += 1) {
    if (!on[start] || labels[start]) continue;
    const label = areas.length;
    let top = 0;
    let area = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const p = stack[--top];
      area += 1;
      const x = p % w;
      if (x > 0 && on[p - 1] && !labels[p - 1]) { labels[p - 1] = label; stack[top++] = p - 1; }
      if (x < w - 1 && on[p + 1] && !labels[p + 1]) { labels[p + 1] = label; stack[top++] = p + 1; }
      if (p >= w && on[p - w] && !labels[p - w]) { labels[p - w] = label; stack[top++] = p - w; }
      if (p < w * (h - 1) && on[p + w] && !labels[p + w]) { labels[p + w] = label; stack[top++] = p + w; }
    }
    areas.push(area);
  }
  return { labels, areas };
}

// One pass of 4-neighbour erosion (grow = false) or dilation (grow = true).
function morph(src, w, h, grow) {
  const out = new Uint8Array(src);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if (Boolean(src[p]) === grow) continue;
      const hit = (x > 0 && Boolean(src[p - 1]) === grow) || (x < w - 1 && Boolean(src[p + 1]) === grow)
        || (y > 0 && Boolean(src[p - w]) === grow) || (y < h - 1 && Boolean(src[p + w]) === grow);
      // Erosion also eats pixels on the image border, so the band exists there too.
      const atBorder = !grow && (x === 0 || y === 0 || x === w - 1 || y === h - 1);
      if (hit || atBorder) out[p] = grow ? 1 : 0;
    }
  }
  return out;
}

// mask: Float32Array laid out with row stride `stride`; the useful area is w × h.
export function cleanMask(mask, stride, w, h, edge = [0.12, 0.88]) {
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) solid[y * w + x] = mask[y * stride + x] > 0.5 ? 1 : 0;

  // 1. Keep the main object (and any comparably large one); drop fragments and haze islands.
  const { labels, areas } = components(solid, w, h);
  const largest = Math.max(0, ...areas);
  for (let p = 0; p < w * h; p += 1) if (solid[p] && areas[labels[p]] < largest * KEEP_RATIO) solid[p] = 0;

  // 2. Close narrow gaps in the outline (dilate, then erode back) before looking for holes.
  let closed = solid;
  for (let i = 0; i < CLOSE; i += 1) closed = morph(closed, w, h, true);
  for (let i = 0; i < CLOSE; i += 1) closed = morph(closed, w, h, false);
  for (let p = 0; p < w * h; p += 1) if (closed[p]) solid[p] = 1;

  // 3. Fill holes: background that cannot be reached from the image border is inside the product.
  const empty = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p += 1) empty[p] = solid[p] ? 0 : 1;
  const outside = components(empty, w, h);
  const touchesBorder = new Uint8Array(outside.areas.length);
  for (let x = 0; x < w; x += 1) { touchesBorder[outside.labels[x]] = 1; touchesBorder[outside.labels[(h - 1) * w + x]] = 1; }
  for (let y = 0; y < h; y += 1) { touchesBorder[outside.labels[y * w]] = 1; touchesBorder[outside.labels[y * w + w - 1]] = 1; }
  for (let p = 0; p < w * h; p += 1) if (!solid[p] && !touchesBorder[outside.labels[p]]) solid[p] = 1;

  // 4. Interior becomes fully opaque; only a thin band around the outline keeps the soft values.
  let core = solid;
  let reach = solid;
  for (let i = 0; i < EDGE_BAND; i += 1) { core = morph(core, w, h, false); reach = morph(reach, w, h, true); }

  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if (core[p]) out[p] = 1;
      else if (reach[p]) out[p] = smoothstep(edge[0], edge[1], mask[y * stride + x]);
    }
  }
  return out;
}
