import { FF_DPAD_ALL_BUTTON } from '@ff/input/ff-action-map';
import {
  FF_GLYPH_PLAYSTATION,
  FF_GLYPH_STEAM_CONTROLLER,
  FF_GLYPH_STEAM_DECK,
  FF_GLYPH_SWITCH,
  FF_GLYPH_SWITCH2,
  FF_GLYPH_XBOX,
} from '@ff/input/ff-glyph-codes';
import type {
  FFControllerFamily,
  FFGlyph,
  FFGlyphCode,
} from '@ff/interfaces/ff-input';

const UNITS_PER_EM = 2048;
// OS/2 typo metrics, shared by all six fonts; they set USE_TYPO_METRICS, so browsers lay out with these, not hhea.
const FONT_ASCENT = 1638;
const FONT_DESCENT = 410;
// Glyphs sit on the baseline at differing heights; this line-height offset centers one in its half-em box.
const CENTERING_OFFSET_EM =
  (FONT_ASCENT - FONT_DESCENT - UNITS_PER_EM / 2) / UNITS_PER_EM;

// Indexed by standard-mapping button: south, east, west, north, LB, RB, LT, RT, select, start, L3, R3, then the D-pad.
// D-pad directions use the outline variants: the plain ones only differ by a second colour the font can't draw.
const GLYPHS: Record<FFControllerFamily, FFGlyphCode[]> = {
  xbox: [
    FF_GLYPH_XBOX.button_a,
    FF_GLYPH_XBOX.button_b,
    FF_GLYPH_XBOX.button_x,
    FF_GLYPH_XBOX.button_y,
    FF_GLYPH_XBOX.lb,
    FF_GLYPH_XBOX.rb,
    FF_GLYPH_XBOX.lt,
    FF_GLYPH_XBOX.rt,
    FF_GLYPH_XBOX.button_view,
    FF_GLYPH_XBOX.button_menu,
    FF_GLYPH_XBOX.stick_l_press,
    FF_GLYPH_XBOX.stick_r_press,
    FF_GLYPH_XBOX.dpad_up_outline,
    FF_GLYPH_XBOX.dpad_down_outline,
    FF_GLYPH_XBOX.dpad_left_outline,
    FF_GLYPH_XBOX.dpad_right_outline,
  ],
  playstation: [
    FF_GLYPH_PLAYSTATION.button_cross,
    FF_GLYPH_PLAYSTATION.button_circle,
    FF_GLYPH_PLAYSTATION.button_square,
    FF_GLYPH_PLAYSTATION.button_triangle,
    FF_GLYPH_PLAYSTATION.trigger_l1,
    FF_GLYPH_PLAYSTATION.trigger_r1,
    FF_GLYPH_PLAYSTATION.trigger_l2,
    FF_GLYPH_PLAYSTATION.trigger_r2,
    FF_GLYPH_PLAYSTATION.playstation5_button_create,
    FF_GLYPH_PLAYSTATION.playstation5_button_options,
    FF_GLYPH_PLAYSTATION.button_l3,
    FF_GLYPH_PLAYSTATION.button_r3,
    FF_GLYPH_PLAYSTATION.dpad_up_outline,
    FF_GLYPH_PLAYSTATION.dpad_down_outline,
    FF_GLYPH_PLAYSTATION.dpad_left_outline,
    FF_GLYPH_PLAYSTATION.dpad_right_outline,
  ],
  switch: [
    FF_GLYPH_SWITCH.button_b,
    FF_GLYPH_SWITCH.button_a,
    FF_GLYPH_SWITCH.button_y,
    FF_GLYPH_SWITCH.button_x,
    FF_GLYPH_SWITCH.button_l,
    FF_GLYPH_SWITCH.button_r,
    FF_GLYPH_SWITCH.button_zl,
    FF_GLYPH_SWITCH.button_zr,
    FF_GLYPH_SWITCH.button_minus,
    FF_GLYPH_SWITCH.button_plus,
    FF_GLYPH_SWITCH.stick_l_press,
    FF_GLYPH_SWITCH.stick_r_press,
    FF_GLYPH_SWITCH.dpad_up_outline,
    FF_GLYPH_SWITCH.dpad_down_outline,
    FF_GLYPH_SWITCH.dpad_left_outline,
    FF_GLYPH_SWITCH.dpad_right_outline,
  ],
  switch2: [
    FF_GLYPH_SWITCH2.button_b,
    FF_GLYPH_SWITCH2.button_a,
    FF_GLYPH_SWITCH2.button_y,
    FF_GLYPH_SWITCH2.button_x,
    FF_GLYPH_SWITCH2.button_l,
    FF_GLYPH_SWITCH2.button_r,
    FF_GLYPH_SWITCH2.button_zl,
    FF_GLYPH_SWITCH2.button_zr,
    FF_GLYPH_SWITCH2.button_minus,
    FF_GLYPH_SWITCH2.button_plus,
    FF_GLYPH_SWITCH2.stick_l_press,
    FF_GLYPH_SWITCH2.stick_r_press,
    FF_GLYPH_SWITCH2.dpad_up_outline,
    FF_GLYPH_SWITCH2.dpad_down_outline,
    FF_GLYPH_SWITCH2.dpad_left_outline,
    FF_GLYPH_SWITCH2.dpad_right_outline,
  ],
  'steam-controller': [
    FF_GLYPH_STEAM_CONTROLLER.button_a,
    FF_GLYPH_STEAM_CONTROLLER.button_b,
    FF_GLYPH_STEAM_CONTROLLER.button_x,
    FF_GLYPH_STEAM_CONTROLLER.button_y,
    FF_GLYPH_STEAM_CONTROLLER.lb,
    FF_GLYPH_STEAM_CONTROLLER.rb,
    FF_GLYPH_STEAM_CONTROLLER.lt,
    FF_GLYPH_STEAM_CONTROLLER.rt,
    FF_GLYPH_STEAM_CONTROLLER.button_back_icon,
    FF_GLYPH_STEAM_CONTROLLER.button_start_icon,
    FF_GLYPH_STEAM_CONTROLLER.stick_l_press,
    FF_GLYPH_STEAM_CONTROLLER.pad,
    FF_GLYPH_STEAM_CONTROLLER.dpad_up_outline,
    FF_GLYPH_STEAM_CONTROLLER.dpad_down_outline,
    FF_GLYPH_STEAM_CONTROLLER.dpad_left_outline,
    FF_GLYPH_STEAM_CONTROLLER.dpad_right_outline,
  ],
  'steam-deck': [
    FF_GLYPH_STEAM_DECK.button_a,
    FF_GLYPH_STEAM_DECK.button_b,
    FF_GLYPH_STEAM_DECK.button_x,
    FF_GLYPH_STEAM_DECK.button_y,
    FF_GLYPH_STEAM_DECK.button_l1,
    FF_GLYPH_STEAM_DECK.button_r1,
    FF_GLYPH_STEAM_DECK.button_l2,
    FF_GLYPH_STEAM_DECK.button_r2,
    FF_GLYPH_STEAM_DECK.button_view,
    FF_GLYPH_STEAM_DECK.button_options,
    FF_GLYPH_STEAM_DECK.stick_l_press,
    FF_GLYPH_STEAM_DECK.stick_r_press,
    FF_GLYPH_STEAM_DECK.dpad_up_outline,
    FF_GLYPH_STEAM_DECK.dpad_down_outline,
    FF_GLYPH_STEAM_DECK.dpad_left_outline,
    FF_GLYPH_STEAM_DECK.dpad_right_outline,
  ],
};

// The all-directions D-pad, which has no button index of its own.
const DPAD_ALL_GLYPHS: Record<FFControllerFamily, FFGlyphCode> = {
  xbox: FF_GLYPH_XBOX.dpad_all,
  playstation: FF_GLYPH_PLAYSTATION.dpad_all,
  switch: FF_GLYPH_SWITCH.dpad_all,
  switch2: FF_GLYPH_SWITCH2.dpad_all,
  'steam-controller': FF_GLYPH_STEAM_CONTROLLER.dpad_all,
  'steam-deck': FF_GLYPH_STEAM_DECK.dpad_all,
};

export function ffGlyph(
  family: FFControllerFamily,
  button: number,
): FFGlyph | undefined {
  const glyph =
    button === FF_DPAD_ALL_BUTTON
      ? DPAD_ALL_GLYPHS[family]
      : GLYPHS[family][button];
  if (!glyph) return undefined;

  return {
    text: String.fromCodePoint(glyph.code),
    lineHeightEm: glyph.inkHeight / UNITS_PER_EM - CENTERING_OFFSET_EM,
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
