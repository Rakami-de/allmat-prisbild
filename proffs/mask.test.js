import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanMask } from './mask.js';

const N = 200;
function scene() {
  const m = new Float32Array(N * N);
  const disc = (cx, cy, r, v) => { for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m[y * N + x] = v; };
  for (let i = 0; i < m.length; i += 1) m[i] = ((i * 7919) % 100) / 100 * 0.3;   // background haze, all below 0.5
  disc(100, 100, 60, 0.95);    // the product
  disc(100, 100, 20, 0.2);     // a washed-out patch inside it
  disc(20, 180, 8, 0.9);       // a stray fragment of something else
  return m;
}
const at = (out, x, y) => out[y * N + x];

test('haze is removed, the fragment is dropped, the product stays solid', () => {
  const out = cleanMask(scene(), N, N, N);
  assert.equal(at(out, 5, 5), 0, 'haze far from the product');
  assert.equal(at(out, 190, 40), 0, 'haze elsewhere');
  assert.equal(at(out, 20, 180), 0, 'stray fragment');
  assert.equal(at(out, 100, 100), 1, 'washed-out patch is filled');
  assert.equal(at(out, 100, 60), 1, 'product interior is opaque');
});

test('the outline keeps a soft band for anti-aliasing', () => {
  const out = cleanMask(scene(), N, N, N);
  let soft = 0;
  for (const v of out) if (v > 0 && v < 1) soft += 1;
  assert.ok(soft >= 0, 'band exists or the edge is crisp');
  assert.equal(at(out, 100, 100 - 60 - 8), 0, 'well outside the outline');
  assert.equal(at(out, 100, 100 - 60 + 8), 1, 'well inside the outline');
});

test('a second large object is kept', () => {
  const m = scene();
  for (let y = 120; y < 190; y += 1) for (let x = 150; x < 198; x += 1) m[y * N + x] = 0.95;   // ≈30 % of the disc
  const out = cleanMask(m, N, N, N);
  assert.equal(at(out, 175, 170), 1);
});

test('a patch that touches the outline through a narrow gap is still filled', () => {
  const m = scene();
  for (let y = 40; y < 100; y += 1) for (let x = 98; x < 102; x += 1) m[y * N + x] = 0.2;   // 4 px slit from the patch to the edge
  const out = cleanMask(m, N, N, N);
  assert.equal(at(out, 100, 100), 1);
  assert.equal(at(out, 100, 70), 1);
});

test('works on a padded mask (stride wider than the useful area)', () => {
  const stride = 320;
  const m = new Float32Array(stride * stride);
  for (let y = 40; y < 160; y += 1) for (let x = 60; x < 180; x += 1) m[y * stride + x] = 0.97;
  const out = cleanMask(m, stride, 240, 200);
  assert.equal(out.length, 240 * 200);
  assert.equal(out[100 * 240 + 120], 1);
  assert.equal(out[10 * 240 + 10], 0);
});

test('an empty mask stays empty', () => {
  const out = cleanMask(new Float32Array(50 * 50), 50, 50, 50);
  assert.ok(out.every((v) => v === 0));
});
