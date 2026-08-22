import { describe, expect, it } from 'vitest';
import { hotkeyMatches } from '@helpers/hotkeys';

function keydown(key: string, modifiers: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, ...modifiers });
}

describe('hotkeyMatches', () => {
  it('matches a single-character key case-insensitively', () => {
    expect(hotkeyMatches(keydown('t'), 't')).toBe(true);
    expect(hotkeyMatches(keydown('T'), 't')).toBe(true);
  });

  it('rejects a different key', () => {
    expect(hotkeyMatches(keydown('r'), 't')).toBe(false);
  });

  it('matches named keys case-insensitively', () => {
    expect(hotkeyMatches(keydown('Escape'), 'ESCAPE')).toBe(true);
    expect(hotkeyMatches(keydown('Backspace'), 'BACKSPACE')).toBe(true);
  });

  it('matches SPACE against the literal space character', () => {
    expect(hotkeyMatches(keydown(' '), 'SPACE')).toBe(true);
    expect(hotkeyMatches(keydown('Spacebar'), 'SPACE')).toBe(false);
  });

  it('rejects non-KeyboardEvent hotkey payloads', () => {
    expect(hotkeyMatches({ keys: 't' }, 't')).toBe(false);
  });

  it('requires a configured modifier to be held', () => {
    expect(hotkeyMatches(keydown('t', { shiftKey: true }), 'shift.t')).toBe(true);
    expect(hotkeyMatches(keydown('t'), 'shift.t')).toBe(false);
  });

  it('does not require a modifier that was not configured', () => {
    expect(hotkeyMatches(keydown('t', { shiftKey: true }), 't')).toBe(true);
  });
});
