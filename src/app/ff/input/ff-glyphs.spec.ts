import { FF_STANDARD_BUTTON } from '@ff/input/ff-action-map';
import { ffGlyph } from '@ff/input/ff-glyphs';
import type { FFControllerFamily } from '@ff/interfaces/ff-input';
import { describe, expect, it } from 'vitest';

const FAMILIES: FFControllerFamily[] = [
  'xbox',
  'playstation',
  'switch',
  'switch2',
  'steam-controller',
  'steam-deck',
];

describe('ffGlyph', () => {
  it.each(FAMILIES)('has a glyph for every standard button on %s', (family) => {
    Object.values(FF_STANDARD_BUTTON).forEach((button) =>
      expect(ffGlyph(family, button)).toBeDefined(),
    );
  });

  it('labels the physical position, not the action', () => {
    expect(ffGlyph('xbox', FF_STANDARD_BUTTON.south)?.text).toBe('');
    expect(ffGlyph('switch', FF_STANDARD_BUTTON.east)?.text).toBe('');
  });

  it('gives shorter glyphs a smaller line-height so they stay centered', () => {
    const face = ffGlyph('xbox', FF_STANDARD_BUTTON.south)?.lineHeightEm ?? 0;
    const bumper = ffGlyph('xbox', FF_STANDARD_BUTTON.lb)?.lineHeightEm ?? 0;
    expect(bumper).toBeLessThan(face);
  });

  it('returns undefined past the standard buttons', () => {
    expect(ffGlyph('xbox', 16)).toBeUndefined();
  });
});
