import {
  afterNextRender,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
} from '@angular/core';
import { ffActionMap } from '@ff/input/ff-action-map';
import { ffCreateGlyphElement } from '@ff/input/ff-glyphs';
import { FFInputService } from '@ff/input/ff-input.service';
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
  popover: 260,
  pauseMenu: 250,
  modal: 200,
  overlay: 100,
  pageMode: 10,
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

  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const unregister = inject(FFFocusService).registerScope(
    GAMEPAD_PRIORITY.overlay,
    () => host,
  );
  inject(DestroyRef).onDestroy(unregister);
}

function gamepadSwalPopup(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '.swal2-container:not(.swal2-backdrop-hide) .swal2-popup',
  );
}

const SWAL_BUTTON_ACTIONS: Array<[string, FFGamepadAction]> = [
  ['.swal2-confirm', 'confirm'],
  ['.swal2-cancel', 'back'],
];

// Swal renders its own buttons, so glyphs are added to its DOM directly.
function gamepadDecorateSwal(input: FFInputService): void {
  document
    .querySelectorAll('.ff-swal-glyph')
    .forEach((glyph) => glyph.remove());
  const popup = gamepadSwalPopup();
  if (!popup || input.mode() !== 'gamepad') return;

  const family = input.family();
  SWAL_BUTTON_ACTIONS.forEach(([selector, action]) => {
    const button = popup.querySelector<HTMLElement>(selector);
    const glyph = ffCreateGlyphElement(family, ffActionMap(family)[action]);
    if (!button || !glyph) return;

    glyph.classList.add('ff-swal-glyph');
    button.prepend(glyph);
  });
}

// Injection context only; keeps controller focus inside open swals and shows A/B on their buttons.
export function gamepadBindSwal(): void {
  const input = inject(FFInputService);
  const decorate = () => gamepadDecorateSwal(input);
  effect(decorate);

  // Swal appends its container to <body>, then fills it, so decorate on the next frame.
  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(document.body, { childList: true });

  const unregister = inject(FFFocusService).registerScope(
    GAMEPAD_PRIORITY.dialog,
    gamepadSwalPopup,
  );
  inject(DestroyRef).onDestroy(() => {
    observer.disconnect();
    unregister();
  });
}

// Injection context only; LT/RT step through the party while the calling component is visible.
export function gamepadBindHeroCycle(
  currentId: () => CharacterId | undefined,
  select: (characterId: CharacterId) => void,
  partyIds: () => CharacterId[] = () =>
    worldPartyState().map((character) => character.id),
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
    enabled: () => partyIds().length > 1 && !modalHasAnyOpen(),
    label: 'Switch Hero',
  };
  const step = (direction: 1 | -1) => {
    const id = currentId();
    if (!id) return;

    select(cycleStep(partyIds(), id, direction));
    afterNextRender(focusSelectedTab, { injector });
  };

  ffGamepadOn('subPrev', () => step(-1), options);
  ffGamepadOn('subNext', () => step(1), options);
}
