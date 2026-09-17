// Prices are handled as integer öre so nothing on a generated image is ever off by a float.

const MAX_ORE = 9_999_999;
const THIN_NBSP = ' ';

function toAsciiDigits(text) {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٫،]/g, ','); // Arabic decimal separator and Arabic comma
}

function clean(input) {
  return toAsciiDigits(String(input ?? ''))
    .replace(/kr/gi, '')
    .replace(/:-/g, '')
    .replace(/[\s  ]/g, '');
}

export function parsePrice(input) {
  const text = clean(input);
  if (text === '') return { ok: false, reason: 'empty' };

  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return { ok: false, reason: 'invalid' };

  const ore = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (ore < 1 || ore > MAX_ORE) return { ok: false, reason: 'range' };
  return { ok: true, ore };
}

export function formatPriceParts(ore) {
  const kronor = Math.floor(ore / 100);
  const rest = ore % 100;
  return {
    int: String(kronor).replace(/\B(?=(\d{3})+$)/g, THIN_NBSP),
    dec: rest === 0 ? null : String(rest).padStart(2, '0'),
  };
}

export function parseMultiBuy(qtyInput, totalInput) {
  const qtyText = clean(qtyInput);
  if (qtyText === '') return { ok: false, reason: 'empty' };
  const total = parsePrice(totalInput);
  if (!total.ok) return { ok: false, reason: total.reason };
  if (!/^\d{1,2}$/.test(qtyText) || Number(qtyText) < 2) return { ok: false, reason: 'invalid' };
  return { ok: true, qty: Number(qtyText), ore: total.ore };
}
