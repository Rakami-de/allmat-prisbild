// Everything that is specific to one shop lives here, so a second branch is a second config.
// Export colours are fixed values (never CSS variables): dark mode must not change an image.

const RED = '#D10101';
const GREEN = '#1A6309';
const BLACK = '#0E0E0E';
const WHITE = '#FFFFFF';
const MUTED = '#595D54';
const YELLOW = '#FFD21F';

export const STORE = {
  name: 'Allmat Värmland AB',
  brandWords: [['ALLMAT', RED], ['VÄRMLAND', BLACK], ['AB', GREEN]],
  filePrefix: 'allmat',
  logoFull: './assets/brand/logo-full.png',
  logoMark: './assets/brand/logo-mark.png',
  shadow: '#00000052',
  // Colour roles used by the templates in core/layout.js and core/collage.js.
  colorways: {
    rod: { swatch: RED, block: RED, accent: RED, on: WHITE, onMuted: '#FFFFFFCC', line: WHITE, paper: WHITE, ink: BLACK, muted: MUTED },
    gron: { swatch: GREEN, block: GREEN, accent: GREEN, on: WHITE, onMuted: '#FFFFFFCC', line: WHITE, paper: WHITE, ink: BLACK, muted: MUTED },
    svart: { swatch: BLACK, block: BLACK, accent: BLACK, on: WHITE, onMuted: '#FFFFFFB3', line: WHITE, paper: WHITE, ink: BLACK, muted: MUTED },
    gul: { swatch: YELLOW, block: YELLOW, accent: YELLOW, on: BLACK, onMuted: '#0E0E0EB3', line: WHITE, paper: WHITE, ink: BLACK, muted: MUTED },
  },
};

// The Lista sheet comes in three moods built from the same colourway, so they stay one family.
export function listPalette(colorway, style) {
  const c = STORE.colorways[colorway] ?? STORE.colorways.rod;
  if (style === 'farg') {
    return { paper: c.block, ink: c.on, muted: c.onMuted, rule: c.onMuted, tag: WHITE, tagInk: BLACK, label: WHITE, labelInk: BLACK, brandMono: c.on, plate: true };
  }
  if (style === 'mork') {
    // A black tag would vanish on the dark sheet, so Svart flips to white tags.
    const flip = c.block === BLACK;
    return { paper: '#121412', ink: WHITE, muted: '#FFFFFFB3', rule: '#FFFFFF33', tag: flip ? WHITE : c.block, tagInk: flip ? BLACK : c.on, label: flip ? WHITE : c.block, labelInk: flip ? BLACK : c.on, brandMono: WHITE, plate: true };
  }
  return { paper: WHITE, ink: BLACK, muted: MUTED, rule: '#E4E5DF', tag: c.block, tagInk: c.on, label: c.block, labelInk: c.on, brandMono: null, plate: false };
}
