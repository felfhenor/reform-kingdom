import {
  afterNextRender,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
} from '@angular/core';
import { FFInputService } from '@ff/input/ff-input.service';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import type { FFGamepadAction, FFInputMode } from '@ff/interfaces/ff-input';
import { cycleStep } from '@helpers/engine/gameplay-view-cycle.ui';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { worldPartyState } from '@helpers/state-game';
import type { CharacterId } from '@interfaces';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
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
