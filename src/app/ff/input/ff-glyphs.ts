import type { FFControllerFamily, FFGlyph } from '@ff/interfaces/ff-input';

const UNITS_PER_EM = 2048;
// OS/2 typo metrics, shared by all six fonts; they set USE_TYPO_METRICS, so browsers lay out with these, not hhea.
const FONT_ASCENT = 1638;
const FONT_DESCENT = 410;
// Glyphs sit on the baseline at differing heights; this line-height offset centers one in its half-em box.
const CENTERING_OFFSET_EM =
  (FONT_ASCENT - FONT_DESCENT - UNITS_PER_EM / 2) / UNITS_PER_EM;

// [code point, ink height in font units], indexed by standard-mapping button (south, east, west, north, LB, RB, LT, RT, select, start, L3, R3, up, down, left, right).
const GLYPHS: Record<FFControllerFamily, Array<[number, number]>> = {
  xbox: [
    [0xe004, 983],
    [0xe006, 983],
    [0xe01e, 983],
    [0xe020, 983],
    [0xe043, 655],
    [0xe049, 655],
    [0xe047, 901],
    [0xe04d, 901],
    [0xe01c, 983],
    [0xe014, 983],
    [0xe053, 1065],
    [0xe05b, 1065],
    [0xe036, 983],
    [0xe025, 983],
    [0xe029, 983],
    [0xe02c, 983],
  ],
  playstation: [
    [0xe04b, 983],
    [0xe041, 983],
    [0xe051, 983],
    [0xe053, 983],
    [0xe078, 901],
    [0xe080, 901],
    [0xe07c, 983],
    [0xe084, 983],
    [0xe01e, 921],
    [0xe024, 942],
    [0xe04d, 983],
    [0xe04f, 983],
    [0xe061, 983],
    [0xe058, 983],
    [0xe05c, 983],
    [0xe05f, 983],
  ],
  switch: [
    [0xe006, 983],
    [0xe004, 983],
    [0xe01a, 983],
    [0xe018, 983],
    [0xe00a, 819],
    [0xe010, 819],
    [0xe01c, 901],
    [0xe01e, 901],
    [0xe00c, 983],
    [0xe00e, 983],
    [0xe05e, 1065],
    [0xe066, 1065],
    [0xe03d, 983],
    [0xe034, 983],
    [0xe038, 983],
    [0xe03b, 983],
  ],
  switch2: [
    [0xe006, 983],
    [0xe004, 983],
    [0xe020, 983],
    [0xe01e, 983],
    [0xe010, 819],
    [0xe016, 819],
    [0xe022, 901],
    [0xe024, 901],
    [0xe012, 983],
    [0xe014, 983],
    [0xe068, 1065],
    [0xe070, 1065],
    [0xe043, 983],
    [0xe03a, 983],
    [0xe03e, 983],
    [0xe041, 983],
  ],
  'steam-controller': [
    [0xe022, 983],
    [0xe024, 983],
    [0xe036, 983],
    [0xe038, 983],
    [0xe049, 775],
    [0xe055, 775],
    [0xe04d, 982],
    [0xe059, 982],
    [0xe026, 655],
    [0xe034, 655],
    [0xe05e, 1065],
    [0xe04f, 983],
    [0xe046, 983],
    [0xe03d, 983],
    [0xe041, 983],
    [0xe044, 983],
  ],
  'steam-deck': [
    [0xe001, 983],
    [0xe003, 983],
    [0xe01d, 983],
    [0xe01f, 983],
    [0xe007, 983],
    [0xe013, 983],
    [0xe009, 983],
    [0xe015, 983],
    [0xe01b, 410],
    [0xe00f, 410],
    [0xe034, 1065],
    [0xe03c, 1065],
    [0xe02d, 983],
    [0xe024, 983],
    [0xe028, 983],
    [0xe02b, 983],
  ],
};

export function ffGlyph(
  family: FFControllerFamily,
  button: number,
): FFGlyph | undefined {
  const glyph = GLYPHS[family][button];
  if (!glyph) return undefined;

  const [codePoint, inkHeight] = glyph;
  return {
    text: String.fromCodePoint(codePoint),
    lineHeightEm: inkHeight / UNITS_PER_EM - CENTERING_OFFSET_EM,
  };
}

// For DOM the app doesn't render itself (e.g. third-party dialogs); templates use <ff-input-prompt>.
export function ffCreateGlyphElement(
  family: FFControllerFamily,
  button: number,
): HTMLElement | undefined {
  const glyph = ffGlyph(family, button);
  if (!glyph) return undefined;

  const element = document.createElement('span');
  element.className = `ff-glyph ff-glyph-${family}`;
  element.style.lineHeight = `${glyph.lineHeightEm}em`;
  element.textContent = glyph.text;
  element.setAttribute('aria-hidden', 'true');
  return element;
}
