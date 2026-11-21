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
import type { FFGamepadAction, FFInputMode } from '@ff/interfaces/ff-input';
import { cycleStep } from '@helpers/engine/gameplay-view-cycle.ui';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { worldPartyState } from '@helpers/state-game';
import type { CharacterId } from '@interfaces';
import type {
  SwalComponent,
  SweetAlert2LoaderService,
} from '@sweetalert2/ngx-sweetalert2';
import type { Instance, ReferenceElement } from 'tippy.js';

export const GAMEPAD_PRIORITY = {
  dialog: 300,
  tutorial: 275,
  popover: 260,
  pauseMenu: 250,
  modal: 200,
  overlay: 100,
  pageMode: 10,
  page: 0,
  global: -50,
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
  // A presses whichever swal button the D-pad focused, so a focused Cancel never confirms.
  const focused = document.activeElement;
  const popup = gamepadSwalPopup();
  if (
    button === 'confirm' &&
    focused instanceof HTMLButtonElement &&
    popup?.contains(focused)
  ) {
    focused.click();
    return;
  }

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
  // Read before any early return, so the effect re-runs when either changes.
  const mode = input.mode();
  const family = input.family();
  document
    .querySelectorAll('.ff-swal-glyph')
    .forEach((glyph) => glyph.remove());
  const popup = gamepadSwalPopup();
  if (!popup || mode !== 'gamepad') return;

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
  let frameId: number | undefined;
  const observer = new MutationObserver(() => {
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(decorate);
  });
  observer.observe(document.body, { childList: true });

  const unregister = inject(FFFocusService).registerScope(
    GAMEPAD_PRIORITY.dialog,
    gamepadSwalPopup,
  );
  inject(DestroyRef).onDestroy(() => {
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    observer.disconnect();
    unregister();
  });
}

// Hero pickers are tab strips (aria-selected) or list rows (aria-current); tabs win, since a page can hold other selected rows.
const SELECTED_HERO_SELECTORS = [
  '[role="tab"][aria-selected="true"]',
  '[aria-current="true"]',
];

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
  const focusSelectedHero = () => {
    focus.releaseFocusOnChange();
    const hero = SELECTED_HERO_SELECTORS.map((selector) =>
      element.querySelector<HTMLElement>(selector),
    ).find(Boolean);
    if (hero) focus.focusElement(hero);
  };
  const options = {
    element,
    enabled: () => partyIds().length > 1 && !modalHasAnyOpen(),
    label: 'Switch Hero',
  };
  const step = (direction: 1 | -1) => {
    const id = currentId();
    if (!id) return;

    // Focus follows the hero picker, not into lists keyed on the hero (ffFocusOnChange).
    focus.holdFocusOnChange();
    select(cycleStep(partyIds(), id, direction));
    afterNextRender(focusSelectedHero, { injector });
  };

  ffGamepadOn('subPrev', () => step(-1), options);
  ffGamepadOn('subNext', () => step(1), options);
  // If the host dies before its afterNextRender, the hold would otherwise never release.
  inject(DestroyRef).onDestroy(() => focus.releaseFocusOnChange());
}

// A tip anchored inside a focusable (e.g. a slot's item art) never gets focus itself, so it opts in with .ff-focus-tip.
function gamepadInnerTip(element: Element): Instance | undefined {
  const anchor = element.querySelector<ReferenceElement>('.ff-focus-tip');
  return anchor?._tippy;
}

// Injection context only.
export function gamepadBindFocusTips(): void {
  const ffInput = inject(FFInputService);
  let shown: Instance | undefined;
  const hide = () => {
    if (shown && !shown.state.isDestroyed) shown.hide();
    shown = undefined;
  };
  effect(() => {
    if (ffInput.mode() !== 'gamepad') hide();
  });
  const onFocusIn = (event: FocusEvent) => {
    hide();
    if (ffInput.mode() !== 'gamepad' || !(event.target instanceof Element))
      return;

    shown = gamepadInnerTip(event.target);
    shown?.show();
  };

  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', hide);
  inject(DestroyRef).onDestroy(() => {
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', hide);
  });
}

// A pad press is easier to misfire than a click, so destructive pad actions confirm first; the swal's (confirm) runs the action.
export function gamepadConfirmFirst(
  mode: FFInputMode,
  swal: SwalComponent | undefined,
  run: () => void,
): void {
  if (mode === 'gamepad' && swal) {
    void swal.fire();
    return;
  }
  run();
}
