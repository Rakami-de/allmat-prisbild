import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBatch, addItem, removeItem, moveItem, updateFields, updateCrop,
  setColorway, setTemplate, itemStatus, readyItems, UNITS, COLORWAYS,
} from '../js/core/batch.js';

const three = () => ['a', 'b', 'c'].reduce(
  (b, id) => addItem(b, { id, photoKey: `p-${id}` }), createBatch());
const ids = (b) => b.items.map((i) => i.id);

test('new batch is empty and red', () => {
  assert.deepEqual(createBatch(), { template: 'sockel', colorway: 'rod', items: [] });
  assert.deepEqual(COLORWAYS, ['rod', 'gron', 'svart']);
  assert.equal(UNITS[0], '');
});

test('addItem appends with blank fields and centred crop', () => {
  const b = three();
  assert.deepEqual(ids(b), ['a', 'b', 'c']);
  assert.equal(b.items[0].photoKey, 'p-a');
  assert.equal(b.items[0].fields.price, '');
  assert.equal(b.items[0].fields.mode, 'standard');
  assert.deepEqual(b.items[0].crop, { x: 0.5, y: 0.5, zoom: 1 });
});

test('removeItem and moveItem', () => {
  assert.deepEqual(ids(removeItem(three(), 'b')), ['a', 'c']);
  assert.deepEqual(ids(removeItem(three(), 'zzz')), ['a', 'b', 'c']);
  assert.deepEqual(ids(moveItem(three(), 'a', 2)), ['b', 'c', 'a']);
  assert.deepEqual(ids(moveItem(three(), 'c', 0)), ['c', 'a', 'b']);
  assert.deepEqual(ids(moveItem(three(), 'a', 99)), ['b', 'c', 'a']);
  assert.deepEqual(ids(moveItem(three(), 'c', -4)), ['c', 'a', 'b']);
});

test('updates are immutable', () => {
  const before = three();
  const after = updateFields(before, 'b', { price: '9,95', unit: '/kg' });
  assert.equal(before.items[1].fields.price, '');
  assert.equal(after.items[1].fields.price, '9,95');
  assert.equal(after.items[1].fields.unit, '/kg');
  assert.equal(after.items[0], before.items[0]);
});

test('updateFields ignores unknown keys, units and modes', () => {
  const b = updateFields(three(), 'a', { hacker: 1, unit: '/mile', mode: 'weird' });
  assert.equal('hacker' in b.items[0].fields, false);
  assert.equal(b.items[0].fields.unit, '');
  assert.equal(b.items[0].fields.mode, 'standard');
});

test('updateCrop clamps', () => {
  const b = updateCrop(three(), 'a', { x: -1, y: 2, zoom: 9 });
  assert.deepEqual(b.items[0].crop, { x: 0, y: 1, zoom: 4 });
  assert.equal(updateCrop(three(), 'a', { zoom: 0.2 }).items[0].crop.zoom, 1);
});

test('setColorway accepts only known colorways', () => {
  assert.equal(setColorway(createBatch(), 'svart').colorway, 'svart');
  assert.equal(setColorway(createBatch(), 'rosa').colorway, 'rod');
});

test('setTemplate accepts only known templates', () => {
  assert.equal(setTemplate(createBatch(), 'kort').template, 'kort');
  assert.equal(setTemplate(createBatch(), 'signatur').template, 'signatur');
  assert.equal(setTemplate(createBatch(), 'retro').template, 'sockel');
});

test('itemStatus', () => {
  const item = (fields) => updateFields(three(), 'a', fields).items[0];
  assert.equal(itemStatus(item({})), 'missing-price');
  assert.equal(itemStatus(item({ price: 'abc' })), 'invalid-price');
  assert.equal(itemStatus(item({ price: '24,95' })), 'ready');
  assert.equal(itemStatus(item({ price: '20', mode: 'kampanj' })), 'invalid-old-price');
  assert.equal(itemStatus(item({ price: '20', mode: 'kampanj', oldPrice: '29,95' })), 'ready');
  assert.equal(itemStatus(item({ price: '30', multiQty: '2' })), 'ready');
  assert.equal(itemStatus(item({ price: '30', multiQty: '1' })), 'invalid-price');
});

test('readyItems keeps order', () => {
  let b = three();
  b = updateFields(b, 'c', { price: '5' });
  b = updateFields(b, 'a', { price: '7' });
  assert.deepEqual(readyItems(b).map((i) => i.id), ['a', 'c']);
});
