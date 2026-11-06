import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
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

function inSwal(event: KeyboardEvent): boolean {
  return !!(event.target as Element | null)?.closest?.('.swal2-container');
}

// Capture phase so navbar hotkeys (pause, view switches) can't act under a story card; Esc and the pause menu stay usable.
// Returns the teardown.
export function hotkeysBlockOutside(host: HTMLElement): () => void {
  const onKeydown = (event: KeyboardEvent) => {
    // Swal stops its own keys from propagating, so the navbar hotkeys never see them.
    if (event.key === 'Escape' || modalHasAnyOpen() || inSwal(event)) return;

    event.stopImmediatePropagation();
    if (event.key === 'Tab' || host.contains(event.target as Node)) return;
    event.preventDefault();
  };

  window.addEventListener('keydown', onKeydown, { capture: true });
  return () =>
    window.removeEventListener('keydown', onKeydown, { capture: true });
}
