// Everything that is specific to one shop lives here, so a second branch is a second config.
// Export colours are fixed values (never CSS variables): dark mode must not change an image.

const RED = '#D10101';
const GREEN = '#1A6309';
const BLACK = '#0E0E0E';
const WHITE = '#FFFFFF';
const MUTED = '#595D54';

export const STORE = {
  name: 'Allmat Värmland AB',
  brandWords: [['ALLMAT', RED], ['VÄRMLAND', BLACK], ['AB', GREEN]],
  filePrefix: 'allmat',
  logoFull: './assets/brand/logo-full.png',
  logoMark: './assets/brand/logo-mark.png',
  shadow: '#0E0E0E40',
  colorways: {
    rod: {
      swatch: RED, paper: WHITE, frame: RED, badge: RED, badgeStroke: WHITE, price: WHITE,
      ink: BLACK, muted: MUTED, tag: GREEN, tagInk: WHITE, weight: WHITE, weightInk: BLACK, weightStroke: RED,
    },
    gron: {
      swatch: GREEN, paper: WHITE, frame: GREEN, badge: WHITE, badgeStroke: GREEN, price: RED,
      ink: GREEN, muted: MUTED, tag: GREEN, tagInk: WHITE, weight: GREEN, weightInk: WHITE, weightStroke: WHITE,
    },
    svart: {
      swatch: BLACK, paper: WHITE, frame: BLACK, badge: BLACK, badgeStroke: WHITE, price: WHITE,
      ink: BLACK, muted: MUTED, tag: BLACK, tagInk: WHITE, weight: BLACK, weightInk: WHITE, weightStroke: WHITE,
    },
  },
};
