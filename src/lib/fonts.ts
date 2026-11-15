// The fonts offered for the two lines at the top of the home page. Chosen in Studio
// ("Home page & About") or with headlineFont / lineFont in src/content/about.md.
// The list itself is fonts.json; the font files are in public/fonts.
// To offer another font: put its .woff2 file in public/fonts and add an entry to fonts.json.
import list from './fonts.json';

export interface FontChoice {
  id: string; label: string; family: string; file: string; weight: number; style: string;
  fallback: string; /** set in capitals */ caps: boolean; /** size relative to the others, so they look equally large */ scale: number; tracking: string;
}
export const FONTS = list as FontChoice[];
export const DEFAULT_HEADLINE_FONT = 'instrument-serif-italic';
export const DEFAULT_LINE_FONT = 'inter-tight-caps';

export const fontChoice = (id: string | undefined, fallback: string): FontChoice =>
  FONTS.find((f) => f.id === id) ?? FONTS.find((f) => f.id === fallback) ?? FONTS[0];

/** The @font-face rules for the given choices (only the fonts in use are loaded). */
export const fontFaces = (...choices: FontChoice[]): string =>
  [...new Map(choices.map((f) => [f.file, f])).values()]
    .map((f) => `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};font-display:swap;src:url('/fonts/${f.file}') format('woff2')}`)
    .join('');

/** Inline style that sets a line in the given font. */
export const fontStyle = (f: FontChoice): string =>
  `font-family:'${f.family}',${f.fallback};font-style:${f.style};font-weight:${f.weight};letter-spacing:${f.tracking};text-transform:${f.caps ? 'uppercase' : 'none'};--scale:${f.scale}`;
