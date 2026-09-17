import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, GEOMETRY } from '../js/core/layout.js';
import { parsePrice, formatPriceParts } from '../js/core/price.js';

// Deterministic stand-in for canvas measureText: condensed digits, no descenders.
const measure = (text, font) => ({
  width: text.length * font.size * 0.42,
  ascent: font.size * 0.7,
  descent: font.size * 0.15,
});

const parts = (text) => formatPriceParts(parsePrice(text).ore);
const blank = { price: '', unit: '', weight: '', name: '', note: '', mode: 'standard', oldPrice: '', multiQty: '' };
const layoutFor = (price, fields = {}, extra = {}) =>
  computeLayout({ fields: { ...blank, ...fields }, priceParts: parts(price), measure, ...extra });

const rowExtent = (price) => {
  const pieces = [price.multi, price.int, price.dec, price.kr].filter(Boolean);
  return {
    left: Math.min(...pieces.map((p) => p.x)),
    right: Math.max(...pieces.map((p) => p.x + measure(p.text, p.font).width)),
  };
};

test('every realistic price fits inside the badge', () => {
  for (const text of ['9', '9,95', '24,95', '129,95', '999,95', '1 299,95']) {
    for (const unit of ['', '/kg', '/100g']) {
      const { price, warnings } = layoutFor(text, { unit });
      const { left, right } = rowExtent(price);
      assert.ok(price.fits, `${text}${unit} fits`);
      assert.ok(left >= GEOMETRY.priceX[0] - 1 && right <= GEOMETRY.priceX[1] + 1, `${text}${unit} within width`);
      assert.ok(price.int.baseline <= GEOMETRY.priceY[1], `${text}${unit} within height`);
      assert.deepEqual(warnings, []);
    }
  }
});

test('integer size never grows as the price gets longer', () => {
  const sizes = ['9', '24,95', '999,95', '1 299,95'].map((t) => layoutFor(t).price.intSize);
  for (let i = 1; i < sizes.length; i += 1) assert.ok(sizes[i] <= sizes[i - 1], sizes.join(' ≥ '));
  assert.ok(sizes[0] > 208);
  assert.ok(sizes.at(-1) >= 96);
});

test('whole prices have no decimals and put kr on the integer baseline', () => {
  const { price } = layoutFor('24');
  assert.equal(price.dec, null);
  assert.equal(price.kr.baseline, price.int.baseline);
  assert.ok(price.kr.x > price.int.x);
});

test('decimals hang from the cap line with kr beneath them', () => {
  const { price } = layoutFor('24,95');
  assert.equal(price.dec.text, '95');
  assert.equal(price.dec.x, price.kr.x);
  assert.ok(price.dec.baseline < price.kr.baseline);
  assert.ok(price.kr.baseline <= price.int.baseline);
});

test('unit is a centred second row and reclaims its space when absent', () => {
  const withUnit = layoutFor('24,95', { unit: '/kg' }).price;
  const without = layoutFor('24,95').price;
  assert.equal(without.unit, null);
  assert.equal(withUnit.unit.text, '/kg');
  assert.ok(withUnit.unit.baseline > withUnit.int.baseline);
  assert.ok(withUnit.int.baseline < without.int.baseline);
});

test('old price only shows in Kampanj and pushes the price down', () => {
  const old = parts('39,95');
  const kampanj = layoutFor('29,95', { mode: 'kampanj' }, { oldPriceParts: old });
  assert.equal(kampanj.price.old.text, 'Ord. 39,95 kr');
  assert.ok(kampanj.price.old.strike.x1 > kampanj.price.old.x);
  assert.ok(kampanj.price.int.baseline - kampanj.price.intSize * 0.7 >= GEOMETRY.priceYWithOld[0] - 1);
  assert.equal(layoutFor('29,95', { mode: 'standard' }, { oldPriceParts: old }).price.old, null);
});

test('multi-buy prefix sits left of the integer', () => {
  const { price } = layoutFor('30', { multiQty: '2' });
  assert.equal(price.multi.text, '2 för');
  assert.ok(price.multi.x < price.int.x);
  assert.equal(layoutFor('30').price.multi, null);
});

test('optional elements collapse to null', () => {
  const l = layoutFor('24,95');
  assert.equal(l.tag, null);
  assert.equal(l.weight, null);
  assert.equal(l.name, null);
  assert.equal(l.note, null);
});

test('mode tag is right-aligned in the header', () => {
  const { tag } = layoutFor('5', { mode: 'nyhet' });
  assert.equal(tag.text, 'NYHET');
  assert.equal(tag.x + tag.w, GEOMETRY.tag.right);
  assert.equal(layoutFor('5', { mode: 'kampanj' }).tag.text, 'KAMPANJ');
});

test('name wraps to two lines, note starts where name ends', () => {
  const short = layoutFor('5', { name: 'Kvisttomater', note: 'Färska idag' });
  assert.equal(short.name.lines.length, 1);
  assert.equal(short.name.lines[0].x, GEOMETRY.stack.x);
  assert.ok(short.note.lines[0].baseline > short.name.lines[0].baseline);

  const long = layoutFor('5', { name: 'Mahmood Sella Basmati Ris Extra Långkornigt', note: 'Färska idag' });
  assert.equal(long.name.lines.length, 2);
  assert.ok(long.note.lines.at(-1).baseline <= GEOMETRY.stack.bottom);
  assert.ok(long.note.lines[0].baseline > short.note.lines[0].baseline);
});

test('overlong text is ellipsised and reported, never overflowing the stack', () => {
  const l = layoutFor('5', { name: 'ord '.repeat(40) });
  assert.ok(l.warnings.includes('name-overflow'));
  assert.ok(l.name.lines.at(-1).text.endsWith('…'));
  for (const line of l.name.lines) assert.ok(measure(line.text, l.name.font).width <= GEOMETRY.stack.maxW);
});

test('weight pill hugs its text and stays on the photo corner', () => {
  const { weight, photo } = layoutFor('99,95', { weight: '5 kg' });
  assert.equal(weight.text, '5 kg');
  assert.ok(weight.y + weight.h < photo.y + photo.h);
  assert.ok(weight.x + weight.w < GEOMETRY.badge.x);
});

test('Grön gets the heavier side frame', () => {
  assert.equal(layoutFor('5', {}, { colorway: 'gron' }).frame.side, 32);
  assert.equal(layoutFor('5', {}, { colorway: 'rod' }).frame.side, 20);
});

test('impossible input is flagged, not clipped', () => {
  const wide = (text, font) => ({ width: text.length * font.size * 2, ascent: font.size * 0.7, descent: 0 });
  const l = computeLayout({ fields: { ...blank, multiQty: '12' }, priceParts: parts('99 999,95'), measure: wide });
  assert.equal(l.price.fits, false);
  assert.ok(l.warnings.includes('price-overflow'));
});
