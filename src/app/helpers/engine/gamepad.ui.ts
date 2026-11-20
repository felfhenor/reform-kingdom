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

// A closing swal keeps its container until the hide animation ends.
export function gamepadSwalShown(): boolean {
  return !!document.querySelector('.swal2-container:not(.swal2-backdrop-hide)');
}

// A visible swal means the lazy library is already loaded, so the click lands immediately.
export function gamepadSwalClick(
  loader: SweetAlert2LoaderService,
  button: 'confirm' | 'cancel',
): void {
  void loader.swal.then((swal) =>
    button === 'confirm' ? swal.clickConfirm() : swal.clickCancel(),
  );
}

const OVERLAY_BLOCKED_ACTIONS: FFGamepadAction[] = [
  'tabPrev',
  'tabNext',
  'pause',
  'recenter',
  'back',
];

// Story cards and overlays sit outside the modal stack; injection context only.
export function gamepadBlockBehindOverlay(): void {
  OVERLAY_BLOCKED_ACTIONS.forEach((action) =>
    ffGamepadOn(action, () => true, { priority: GAMEPAD_PRIORITY.overlay }),
  );
}
