import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import type { FFGamepadAction } from '@ff/interfaces/ff-input';
import type { SweetAlert2LoaderService } from '@sweetalert2/ngx-sweetalert2';

export const GAMEPAD_PRIORITY = {
  dialog: 300,
  tutorial: 275,
  pauseMenu: 250,
  modal: 200,
  overlay: 100,
  page: 0,
} as const;

// A visible swal means the lazy library is already loaded, so the click lands immediately.
export function gamepadSwalClick(
  loader: SweetAlert2LoaderService,
  button: 'confirm' | 'cancel',
): boolean {
  // A closing swal keeps its container until the hide animation ends.
  const isShown = !!document.querySelector(
    '.swal2-container:not(.swal2-backdrop-hide)',
  );
  if (!isShown) return false;

  void loader.swal.then((swal) =>
    button === 'confirm' ? swal.clickConfirm() : swal.clickCancel(),
  );
  return true;
}

const OVERLAY_BLOCKED_ACTIONS: FFGamepadAction[] = [
  'tabPrev',
  'tabNext',
  'pause',
  'back',
];

// Story cards and overlays sit outside the modal stack; injection context only.
export function gamepadBlockBehindOverlay(): void {
  OVERLAY_BLOCKED_ACTIONS.forEach((action) =>
    ffGamepadOn(action, () => true, { priority: GAMEPAD_PRIORITY.overlay }),
  );
}
