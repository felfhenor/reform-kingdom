import { ffHotkeyMatches } from '@ff/input/ff-hotkeys';
import { describe, expect, it } from 'vitest';

describe('ffHotkeyMatches', () => {
  it('matches keys case-insensitively and maps space', () => {
    expect(
      ffHotkeyMatches(new KeyboardEvent('keydown', { key: 'T' }), 't'),
    ).toBe(true);
    expect(
      ffHotkeyMatches(new KeyboardEvent('keydown', { key: ' ' }), 'SPACE'),
    ).toBe(true);
    expect(
      ffHotkeyMatches(new KeyboardEvent('keydown', { key: 'x' }), 't'),
    ).toBe(false);
  });

  it('requires listed modifiers', () => {
    expect(
      ffHotkeyMatches(new KeyboardEvent('keydown', { key: 's' }), 'control.s'),
    ).toBe(false);
    expect(
      ffHotkeyMatches(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true }),
        'control.s',
      ),
    ).toBe(true);
  });
});
