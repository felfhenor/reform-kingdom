import type { Hotkey } from '@ngneat/hotkeys';

const MODIFIER_KEYS: Record<string, (event: KeyboardEvent) => boolean> = {
  control: (event) => event.ctrlKey,
  alt: (event) => event.altKey,
  shift: (event) => event.shiftKey,
  meta: (event) => event.metaKey,
};

// NG_EVENT_PLUGINS' OptionsEventPlugin mis-claims "keydown.t"/"keydown.r" (their letters are
// substrings of its own "capture.once.passive"), leaving those hotkeys unfiltered by key.
export function hotkeyMatches(event: KeyboardEvent | Hotkey, key: string): boolean {
  if (!(event instanceof KeyboardEvent)) return false;

  const segments = key.toLowerCase().split('.');
  const targetKey = segments.pop() ?? '';
  const keyMatches =
    targetKey === 'space' ? event.key === ' ' : event.key.toLowerCase() === targetKey;
  if (!keyMatches) return false;

  return segments.every((modifier) => MODIFIER_KEYS[modifier]?.(event) ?? false);
}
