import { signal } from '@angular/core';

export const FONT_FAMILY_DEFAULT = 'OtherText';
export const FONT_FAMILY_CLEAN = 'CleanText';

// Pixi bakes text into textures, so this only flips once the face has loaded (else labels stick on the fallback font).
export const uiTextFontFamily = signal<string>(FONT_FAMILY_DEFAULT);

// Mirrors `--font-letter-spacing`: the pixel font needs the extra 1px, the clean one doesn't.
export function uiTextLetterSpacing(): number {
  return uiTextFontFamily() === FONT_FAMILY_CLEAN ? 0 : 1;
}
