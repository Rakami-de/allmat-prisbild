import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPages, pageGrid, computeCollagePage, PAGE_MAX, W } from '../js/core/collage.js';
import { parsePrice, formatPriceParts } from '../js/core/price.js';

const measure = (text, font) => ({ width: text.length * font.size * 0.42, ascent: font.size * 0.7, descent: font.size * 0.15 });
const blank = { price: '', unit: '', weight: '', name: '', note: '', mode: 'standard', oldPrice: '', multiQty: '' };
const entry = (price, fields = {}) => ({ fields: { ...blank, price, ...fields }, priceParts: formatPriceParts(parsePrice(price).ore) });
const page = (n, options = {}, fields = {}) =>
  computeCollagePage({ entries: Array.from({ length: n }, () => entry('24,95', { unit: '/kg', ...fields })), measure, ...options });

test('pages never exceed the maximum and are balanced', () => {
  assert.deepEqual(planPages(0), []);
  assert.deepEqual(planPages(7), [{ start: 0, end: 7 }]);
  assert.deepEqual(planPages(20), [{ start: 0, end: 20 }]);
  assert.deepEqual(planPages(21), [{ start: 0, end: 11 }, { start: 11, end: 21 }]);
  assert.deepEqual(planPages(25), [{ start: 0, end: 13 }, { start: 13, end: 25 }]);
  for (let n = 1; n <= 75; n += 1) {
    const pages = planPages(n);
    assert.equal(pages.at(-1).end, n);
    assert.ok(pages.every((p) => p.end - p.start <= PAGE_MAX && p.end > p.start), `n=${n}`);
  }
});

test('few products stay square, many use the taller sheet', () => {
  assert.deepEqual(pageGrid(1), { cols: 1, H: 1080 });
  assert.deepEqual(pageGrid(4), { cols: 2, H: 1080 });
  assert.deepEqual(pageGrid(6), { cols: 3, H: 1080 });
  assert.deepEqual(pageGrid(12), { cols: 3, H: 1350 });
  assert.deepEqual(pageGrid(20), { cols: 4, H: 1350 });
});

test('every cell stays on the sheet, between header and footer, without overlapping', () => {
  for (let n = 1; n <= PAGE_MAX; n += 1) {
    const l = page(n, { title: 'Veckans erbjudanden', footer: 'Så långt lagret räcker' });
    assert.equal(l.cells.length, n);
    for (const [i, c] of l.cells.entries()) {
      assert.ok(c.x >= 0 && c.x + c.w <= W, `n=${n} cell ${i} x`);
      assert.ok(c.y >= 170 && c.y + c.h <= l.rule.y, `n=${n} cell ${i} y`);
      for (const other of l.cells.slice(i + 1)) {
        const apart = c.x + c.w <= other.x || other.x + other.w <= c.x || c.y + c.h <= other.y || other.y + other.h <= c.y;
        assert.ok(apart, `n=${n} cells overlap`);
      }
    }
  }
});

test('a short last row is centred', () => {
  const l = page(5);
  const last = l.cells.slice(3);
  const left = last[0].x;
  const right = W - (last[1].x + last[1].w);
  assert.ok(Math.abs(left - right) <= 2, `${left} vs ${right}`);
});

test('every price fits inside its tag, including long and multi-buy prices', () => {
  for (const n of [1, 4, 6, 12, 20]) {
    for (const [price, fields] of [['9', {}], ['1000', { unit: '/kg' }], ['1299,95', { unit: '/100g' }], ['10', { multiQty: '5' }]]) {
      const l = computeCollagePage({ entries: Array.from({ length: n }, () => entry(price, { name: 'Citroner', ...fields })), measure });
      for (const c of l.cells) {
        const parts = [c.price.multi, c.price.int, c.price.dec, c.price.kr].filter(Boolean);
        assert.ok(c.price.fits, `n=${n} ${price}`);
        assert.ok(Math.min(...parts.map((p) => p.x)) >= c.tag.x, `n=${n} ${price} left`);
        assert.ok(Math.max(...parts.map((p) => p.x + measure(p.text, p.font).width)) <= c.tag.x + c.tag.w, `n=${n} ${price} right`);
        assert.ok(c.price.int.baseline <= c.tag.y + c.tag.h, `n=${n} ${price} bottom`);
        assert.ok(c.price.int.baseline - c.price.int.font.size * 0.7 >= c.tag.y, `n=${n} ${price} top`);
      }
    }
  }
});

test('the product name is optional and dropped on dense sheets', () => {
  assert.equal(page(6).cells[0].name, null, 'no name given');
  const named = page(6, {}, { name: 'Citroner' }).cells[0];
  assert.equal(named.name.text, 'CITRONER');
  assert.ok(named.name.baseline < named.price.int.baseline);
  assert.equal(page(20, {}, { name: 'Citroner' }).cells[0].name, null, 'too dense for names');
  const long = page(6, {}, { name: 'Mahmood Sella Basmati Ris Extra Långkornigt Premium' }).cells[0];
  assert.ok(long.name.text.endsWith('…'));
  assert.ok(long.name.x >= long.tag.x);
});

test('header pieces collapse when empty and never collide', () => {
  const bare = page(6);
  assert.deepEqual([bare.title, bare.note, bare.footer, bare.pageMark], [null, null, null, null]);
  assert.ok(bare.brand.size > 40, 'the shop name takes the title spot');

  const full = page(6, { title: 'Veckans erbjudanden med extra mycket text som inte får plats', note: 'Gäller 18–24 september', footer: 'Så långt lagret räcker', pageLabel: '1/2' });
  assert.ok(full.title.label.x >= full.logo.x + full.logo.w);
  assert.ok(full.title.label.x + full.title.label.w <= W - 44 + 1);
  assert.ok(full.brand.baseline > full.title.baseline);
  assert.equal(full.pageMark.text, '1/2');
  assert.ok(full.footer.x + measure(full.footer.text, full.footer.font).width <= full.pageMark.x);
});
