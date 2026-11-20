import { afterNextRender, ElementRef, inject, Injector } from '@angular/core';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import type { FFGamepadAction } from '@ff/interfaces/ff-input';
import { cycleStep } from '@helpers/engine/gameplay-view-cycle.ui';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { worldPartyState } from '@helpers/state-game';
import type { CharacterId } from '@interfaces';
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
  'subPrev',
  'subNext',
  'context',
  'details',
  'back',
];

// Story cards and overlays sit outside the modal stack; injection context only.
export function gamepadBlockBehindOverlay(): void {
  OVERLAY_BLOCKED_ACTIONS.forEach((action) =>
    ffGamepadOn(action, () => true, { priority: GAMEPAD_PRIORITY.overlay }),
  );
}

// Injection context only; LT/RT step through the party while the calling component is visible.
export function gamepadBindHeroCycle(
  currentId: () => CharacterId | undefined,
  select: (characterId: CharacterId) => void,
): void {
  const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const injector = inject(Injector);
  const focus = inject(FFFocusService);
  const focusSelectedTab = () => {
    const tab = element.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (tab) focus.focusElement(tab);
  };
  const options = {
    element,
    enabled: () => worldPartyState().length > 1 && !modalHasAnyOpen(),
    label: 'Switch Hero',
  };
  const step = (direction: 1 | -1) => {
    const id = currentId();
    const ids = worldPartyState().map((character) => character.id);
    if (!id) return;

    select(cycleStep(ids, id, direction));
    afterNextRender(focusSelectedTab, { injector });
  };

  ffGamepadOn('subPrev', () => step(-1), options);
  ffGamepadOn('subNext', () => step(1), options);
}
