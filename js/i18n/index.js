import sv from './sv.js';
import ar from './ar.js';

export const LANGS = ['sv', 'ar'];
export const DEFAULT_LANG = 'sv';
const TABLES = { sv, ar };

export function createI18n(lang) {
  const active = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const table = TABLES[active];

  function t(key, vars = {}) {
    // Swedish singular: 'x.one' wins when n is 1 ("1 bild", not "1 bilder").
    const one = vars.n === 1 ? table[`${key}.one`] : undefined;
    const template = one ?? table[key] ?? sv[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
  }

  return { lang: active, dir: active === 'ar' ? 'rtl' : 'ltr', t };
}

export { TABLES };
