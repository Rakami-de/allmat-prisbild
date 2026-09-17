import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, TABLES, DEFAULT_LANG } from '../js/i18n/index.js';

test('Swedish is the default and the fallback for unknown languages', () => {
  assert.equal(DEFAULT_LANG, 'sv');
  assert.equal(createI18n().lang, 'sv');
  assert.equal(createI18n('de').lang, 'sv');
  assert.equal(createI18n('sv').dir, 'ltr');
  assert.equal(createI18n('sv').t('home.takePhoto'), 'Ta foto');
});

test('Arabic is right-to-left', () => {
  const i18n = createI18n('ar');
  assert.equal(i18n.dir, 'rtl');
  assert.equal(i18n.t('home.takePhoto'), 'التقط صورة');
});

test('both languages define exactly the same keys', () => {
  assert.deepEqual(Object.keys(TABLES.ar).sort(), Object.keys(TABLES.sv).sort());
});

test('placeholders used in one language exist in the other', () => {
  const vars = (s) => (s.match(/\{\w+\}/g) ?? []).sort();
  for (const key of Object.keys(TABLES.sv)) {
    assert.deepEqual(vars(TABLES.ar[key]), vars(TABLES.sv[key]), key);
  }
});

test('interpolation and missing keys', () => {
  const { t } = createI18n('sv');
  assert.equal(t('batch.ready', { n: 3, total: 12 }), '3 av 12 klara');
  assert.equal(t('batch.ready', { n: 3 }), '3 av {total} klara');
  assert.equal(t('no.such.key'), 'no.such.key');
});
