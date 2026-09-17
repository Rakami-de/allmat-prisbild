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
  shadow: '#00000052',
  // Colour roles used by the templates in core/layout.js.
  colorways: {
    rod: { swatch: RED, block: RED, accent: RED, on: WHITE, onMuted: '#FFFFFFCC', paper: WHITE, ink: BLACK, muted: MUTED },
    gron: { swatch: GREEN, block: GREEN, accent: GREEN, on: WHITE, onMuted: '#FFFFFFCC', paper: WHITE, ink: BLACK, muted: MUTED },
    svart: { swatch: BLACK, block: BLACK, accent: BLACK, on: WHITE, onMuted: '#FFFFFFB3', paper: WHITE, ink: BLACK, muted: MUTED },
  },
};
