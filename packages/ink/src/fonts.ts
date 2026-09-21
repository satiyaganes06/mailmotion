import type { InkFontId } from '@mailmotion/schema';

export interface InkFont {
  id: InkFontId;
  name: string;
  file: string;
  license: 'OFL-1.1' | 'Apache-2.0';
}

export const INK_FONTS: readonly InkFont[] = [
  { id: 'caveat', name: 'Caveat', file: 'Caveat.ttf', license: 'OFL-1.1' },
  { id: 'dancing-script', name: 'Dancing Script', file: 'DancingScript.ttf', license: 'OFL-1.1' },
  { id: 'great-vibes', name: 'Great Vibes', file: 'GreatVibes-Regular.ttf', license: 'OFL-1.1' },
  { id: 'allura', name: 'Allura', file: 'Allura-Regular.ttf', license: 'OFL-1.1' },
  { id: 'sacramento', name: 'Sacramento', file: 'Sacramento-Regular.ttf', license: 'OFL-1.1' },
  {
    id: 'homemade-apple',
    name: 'Homemade Apple',
    file: 'HomemadeApple-Regular.ttf',
    license: 'Apache-2.0',
  },
  { id: 'yellowtail', name: 'Yellowtail', file: 'Yellowtail-Regular.ttf', license: 'Apache-2.0' },
  { id: 'satisfy', name: 'Satisfy', file: 'Satisfy-Regular.ttf', license: 'Apache-2.0' },
  { id: 'mr-dafoe', name: 'Mr Dafoe', file: 'MrDafoe-Regular.ttf', license: 'OFL-1.1' },
  { id: 'marck-script', name: 'Marck Script', file: 'MarckScript-Regular.ttf', license: 'OFL-1.1' },
];

/** Sans font used for initials and banner text, so output never depends on system fonts. */
export const UI_FONT_FILE = 'Poppins-SemiBold.ttf';

export function getInkFont(id: InkFontId): InkFont {
  const f = INK_FONTS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown ink font: ${id}`);
  return f;
}

/** Hosts provide font bytes (fetch in the browser, fs in Node). */
export type FontLoader = (file: string) => Promise<ArrayBuffer>;
