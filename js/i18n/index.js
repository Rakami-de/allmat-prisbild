import sv from './sv.js';
import ar from './ar.js';

export const LANGS = ['sv', 'ar'];
export const DEFAULT_LANG = 'sv';
const TABLES = { sv, ar };

export function createI18n(lang) {
  const active = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const table = TABLES[active];

  function t(key, vars = {}) {
    const template = table[key] ?? sv[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
  }

  return { lang: active, dir: active === 'ar' ? 'rtl' : 'ltr', t };
}

export { TABLES };
