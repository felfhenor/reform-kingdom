import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
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
    // Ctrl/Cmd shortcuts (copy) aren't game hotkeys, so the browser keeps them.
    const isShortcut = event.ctrlKey || event.metaKey;
    if (
      event.key === 'Tab' ||
      isShortcut ||
      host.contains(event.target as Node)
    )
      return;
    event.preventDefault();
  };

  window.addEventListener('keydown', onKeydown, { capture: true });
  return () =>
    window.removeEventListener('keydown', onKeydown, { capture: true });
}
