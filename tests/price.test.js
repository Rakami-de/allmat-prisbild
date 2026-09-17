import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, formatPriceParts, parseMultiBuy } from '../js/core/price.js';

const ok = (ore) => ({ ok: true, ore });
const bad = (reason) => ({ ok: false, reason });

test('parses Swedish and international decimal formats', () => {
  assert.deepEqual(parsePrice('24,95'), ok(2495));
  assert.deepEqual(parsePrice('24.95'), ok(2495));
  assert.deepEqual(parsePrice('24'), ok(2400));
  assert.deepEqual(parsePrice('24,5'), ok(2450));
  assert.deepEqual(parsePrice('0,50'), ok(50));
});

test('tolerates currency decoration and whitespace', () => {
  assert.deepEqual(parsePrice('24:-'), ok(2400));
  assert.deepEqual(parsePrice(' 9,95 kr'), ok(995));
  assert.deepEqual(parsePrice('99.95KR'), ok(9995));
  assert.deepEqual(parsePrice('1 299,95'), ok(129995));
  assert.deepEqual(parsePrice('1 299,95'), ok(129995));
});

test('accepts Arabic-Indic and Persian digits', () => {
  assert.deepEqual(parsePrice('٢٤٫٩٥'), ok(2495));
  assert.deepEqual(parsePrice('۲۴٫۹۵'), ok(2495));
  assert.deepEqual(parsePrice('٩٩،٩٥'), ok(9995));
});

test('rejects bad input with a reason', () => {
  assert.deepEqual(parsePrice(''), bad('empty'));
  assert.deepEqual(parsePrice('   '), bad('empty'));
  assert.deepEqual(parsePrice(null), bad('empty'));
  assert.deepEqual(parsePrice('abc'), bad('invalid'));
  assert.deepEqual(parsePrice('24,955'), bad('invalid'));
  assert.deepEqual(parsePrice('24,9,5'), bad('invalid'));
  assert.deepEqual(parsePrice('-5'), bad('invalid'));
  assert.deepEqual(parsePrice('0'), bad('range'));
  assert.deepEqual(parsePrice('100000'), bad('range'));
});

test('formats parts for the price badge', () => {
  assert.deepEqual(formatPriceParts(2495), { int: '24', dec: '95' });
  assert.deepEqual(formatPriceParts(2400), { int: '24', dec: null });
  assert.deepEqual(formatPriceParts(2405), { int: '24', dec: '05' });
  assert.deepEqual(formatPriceParts(50), { int: '0', dec: '50' });
  assert.deepEqual(formatPriceParts(129995), { int: '1 299', dec: '95' });
});

test('parses multi-buy offers', () => {
  assert.deepEqual(parseMultiBuy('2', '30'), { ok: true, qty: 2, ore: 3000 });
  assert.deepEqual(parseMultiBuy('٣', '25'), { ok: true, qty: 3, ore: 2500 });
  assert.deepEqual(parseMultiBuy('1', '30'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parseMultiBuy('', '30'), { ok: false, reason: 'empty' });
  assert.deepEqual(parseMultiBuy('2', 'x'), { ok: false, reason: 'invalid' });
});
