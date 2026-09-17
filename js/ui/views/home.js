import { h, icon } from '../dom.js';
import { STORE } from '../../config/store.js';

export function renderHome(app) {
  const { t, state } = app;
  const count = state.batch.items.length;
  const otherLang = state.i18n.lang === 'sv' ? 'ar' : 'sv';

  const resume = count === 0 ? null : h('section', { class: 'card resume' },
    h('div', { class: 'resume-text' },
      h('strong', {}, t('home.resume.title')),
      h('span', { class: 'muted' }, t('home.resume.count', { n: count }))),
    h('div', { class: 'resume-actions' },
      h('button', {
        class: 'btn btn-small btn-ghost',
        onclick: async () => {
          const choice = await app.sheet({
            title: t('home.resume.discard'),
            body: t('output.newBatchConfirm'),
            actions: [
              { id: 'yes', label: t('home.resume.discard'), kind: 'btn-danger' },
              { id: 'no', label: t('common.no') },
            ],
          });
          if (choice === 'yes') { await app.discardBatch(); app.refresh(); }
        },
      }, t('home.resume.discard')),
      h('button', { class: 'btn btn-small btn-primary', onclick: () => app.go('batch') }, t('home.resume.open'))));

  return h('main', { class: 'screen home' },
    h('header', { class: 'home-top' },
      h('button', { class: 'lang-toggle', lang: otherLang, onclick: () => app.setLang(otherLang) }, t('lang.switch'))),
    h('div', { class: 'home-hero' },
      h('img', { class: 'home-logo', src: STORE.logoMark, alt: STORE.name, width: 726, height: 548 }),
      h('h1', { class: 'display' }, t('home.title')),
      h('p', { class: 'muted lead' }, t('home.subtitle'))),
    h('div', { class: 'home-actions' },
      resume,
      h('button', { class: 'btn btn-primary btn-large', onclick: app.pickCamera }, icon('camera'), t('home.takePhoto')),
      h('button', { class: 'btn btn-secondary btn-large', onclick: app.pickLibrary }, icon('photos'), t('home.pickPhotos'))));
}
