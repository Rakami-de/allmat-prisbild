import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, TEMPLATES, SIZE } from '../js/core/layout.js';
import { parsePrice, formatPriceParts } from '../js/core/price.js';

// Deterministic stand-in for canvas measureText: condensed glyphs, no descenders.
const measure = (text, font) => ({ width: text.length * font.size * 0.42, ascent: font.size * 0.7, descent: font.size * 0.15 });

const parts = (text) => formatPriceParts(parsePrice(text).ore);
const blank = { price: '', unit: '', weight: '', name: '', note: '', mode: 'standard', oldPrice: '', multiQty: '' };
const layoutFor = (template, price, fields = {}, extra = {}) =>
  computeLayout({ template, fields: { ...blank, ...fields }, priceParts: parts(price), measure, ...extra });

const extent = (price) => {
  const pieces = [price.multi, price.int, price.dec, price.kr].filter(Boolean);
  return {
    left: Math.min(...pieces.map((p) => p.x)),
    right: Math.max(...pieces.map((p) => p.x + measure(p.text, p.font).width)),
    top: price.int.baseline - measure('0', price.int.font).ascent,
  };
};

// The colour shape that carries the price: the last 'block'-filled rectangle of the template.
const priceBlock = (layout) => layout.shapes.filter((s) => s.fill === 'block' && s.w).at(-1);

for (const template of TEMPLATES) {
  test(`${template}: every realistic price stays inside its colour block`, () => {
    for (const text of ['9', '9,95', '24,95', '129,95', '999,95', '1 299,95']) {
      for (const unit of ['', '/kg', '/100g']) {
        const layout = layoutFor(template, text, { unit });
        const block = priceBlock(layout);
        const { left, right, top } = extent(layout.price);
        assert.ok(layout.price.fits, `${text}${unit} fits`);
        assert.ok(left >= block.x && right <= block.x + block.w, `${text}${unit} within block width`);
        assert.ok(top >= block.y && layout.price.int.baseline <= block.y + block.h, `${text}${unit} within block height`);
        assert.deepEqual(layout.warnings, []);
      }
    }
  });

  test(`${template}: integer size never grows as the price gets longer`, () => {
    const sizes = ['9', '24,95', '999,95', '1 299,95'].map((t) => layoutFor(template, t).price.intSize);
    for (let i = 1; i < sizes.length; i += 1) assert.ok(sizes[i] <= sizes[i - 1], sizes.join(' ≥ '));
    assert.ok(sizes.at(-1) >= 80);
  });

  test(`${template}: Kampanj shows a struck old price above a smaller price, inside the block`, () => {
    const old = parts('39,95');
    const plain = layoutFor(template, '29,95');
    const kampanj = layoutFor(template, '29,95', { mode: 'kampanj' }, { oldPriceParts: old });
    const block = priceBlock(kampanj);
    assert.equal(kampanj.price.old.text, 'Ord. 39,95 kr');
    assert.ok(kampanj.price.old.strike.x1 > kampanj.price.old.x);
    assert.ok(kampanj.price.old.baseline < extent(kampanj.price).top, 'old price sits above the price');
    assert.ok(kampanj.price.old.baseline - 34 >= block.y, 'old price inside block');
    assert.ok(kampanj.price.intSize <= plain.price.intSize);
    assert.equal(layoutFor(template, '29,95', { mode: 'standard' }, { oldPriceParts: old }).price.old, null);
  });

  test(`${template}: text column never reaches the price block`, () => {
    const layout = layoutFor(template, '5', { name: 'Mahmood Sella Basmati Ris Extra Långkornigt Premium '.repeat(2), note: 'Färska idag direkt från odlaren i södra Spanien '.repeat(3) });
    const block = priceBlock(layout);
    for (const line of [layout.name, layout.note]) {
      const right = line.x + measure(line.text, line.font).width;
      assert.ok(line.x >= 0 && right <= SIZE);
      if (template !== 'signatur') assert.ok(right <= block.x, `${line.text} stays left of the block`);
      assert.ok(line.text.endsWith('…'));
    }
    assert.ok(layout.warnings.includes('name-overflow'));
    assert.ok(layout.warnings.includes('note-overflow'));
  });
}

test('whole prices have no decimals; kr and unit share the baseline column', () => {
  const { price } = layoutFor('sockel', '24', { unit: '/kg' });
  assert.equal(price.dec, null);
  assert.equal(price.kr.text, 'kr/kg');
  assert.equal(price.kr.baseline, price.int.baseline);
  assert.ok(price.kr.x > price.int.x);
});

test('decimals hang from the cap line above kr', () => {
  const { price } = layoutFor('kort', '24,95');
  assert.equal(price.dec.text, '95');
  assert.equal(price.kr.text, 'kr');
  assert.equal(price.dec.x, price.kr.x);
  assert.ok(price.dec.baseline < price.kr.baseline);
});

test('multi-buy prefix sits left of the integer', () => {
  const { price } = layoutFor('sockel', '30', { multiQty: '2' });
  assert.equal(price.multi.text, '2 för');
  assert.ok(price.multi.x < price.int.x);
  assert.equal(layoutFor('sockel', '30').price.multi, null);
});

test('optional elements collapse to null', () => {
  const l = layoutFor('sockel', '24,95');
  assert.deepEqual([l.tag, l.weight, l.name, l.note], [null, null, null, null]);
});

test('tag and weight pills share a row without overlapping', () => {
  const both = layoutFor('kort', '5', { mode: 'nyhet', weight: '5 kg' });
  assert.equal(both.tag.text, 'NYHET');
  assert.equal(both.weight.text, '5 kg');
  assert.ok(both.weight.x >= both.tag.x + both.tag.w);
  const alone = layoutFor('kort', '5', { weight: '5 kg' });
  assert.equal(alone.weight.x, both.tag.x, 'weight takes the first slot when there is no tag');
  assert.equal(layoutFor('kort', '5', { mode: 'kampanj' }).tag.text, 'KAMPANJ');
});

test('a note without a name moves up into the name position', () => {
  const withName = layoutFor('sockel', '5', { name: 'Citroner', note: 'Färska idag' });
  const alone = layoutFor('sockel', '5', { note: 'Färska idag' });
  assert.equal(alone.note.baseline, withName.name.baseline);
  assert.ok(withName.note.baseline > withName.name.baseline);
});

test('Signatur sets the name in capitals, centred in its column', () => {
  const { name } = layoutFor('signatur', '5', { name: 'Citroner' });
  assert.equal(name.text, 'CITRONER');
  assert.ok(name.x > 60);
});

test('unknown template falls back to Sockel', () => {
  assert.deepEqual(layoutFor('retro', '5').photo, layoutFor('sockel', '5').photo);
});

test('impossible input is flagged, not clipped', () => {
  const wide = (text, font) => ({ width: text.length * font.size * 2, ascent: font.size * 0.7, descent: 0 });
  const l = computeLayout({ template: 'kort', fields: { ...blank, multiQty: '12' }, priceParts: parts('99 999,95'), measure: wide });
  assert.equal(l.price.fits, false);
  assert.ok(l.warnings.includes('price-overflow'));
});
