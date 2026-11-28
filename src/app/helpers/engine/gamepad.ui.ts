import { t } from '@helpers/i18n/i18n';
import {
  afterNextRender,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
} from '@angular/core';
import { FF_DIRECTIONS } from '@ff/input/ff-action-map';
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
    label: t('gamepad.switchHero'),
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

function gamepadInspectStops(host: HTMLElement, selector: string): Instance[] {
  const owner = document.activeElement?.closest(selector);
  if (!owner || !host.contains(owner)) return [];
  return [...owner.querySelectorAll<ReferenceElement>('.ff-inspect-tip')]
    .map((anchor) => anchor._tippy)
    .filter((tip) => !!tip);
}

// Injection context only; L3 pages through the .ff-inspect-tip tips inside the focused `selector` without moving focus.
export function gamepadBindInspectTips(
  selector: string,
  canInspect: () => boolean,
): void {
  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const ffInput = inject(FFInputService);
  const stops = () => gamepadInspectStops(host, selector);
  let shown: Instance | undefined;
  const show = (tip?: Instance) => {
    if (tip === shown) return;
    if (shown && !shown.state.isDestroyed) shown.hide();
    shown = tip;
    tip?.show();
  };
  effect(() => {
    if (!canInspect() || ffInput.mode() !== 'gamepad') show(undefined);
  });
  // A tab switch, pause menu or focus jump silences the close buttons, so the tip must close itself.
  const stopRefresh = ffInput.onRefresh(() => {
    if (!shown) return;
    if (!ffInput.isElementActive(host) || !stops().includes(shown))
      show(undefined);
  });
  inject(DestroyRef).onDestroy(() => {
    stopRefresh();
    show(undefined);
  });

  const options = {
    priority: GAMEPAD_PRIORITY.popover,
    element: host,
    enabled: () => !!shown,
  };
  ffGamepadOn('zone', () => show(shown ? undefined : stops()[0]), {
    ...options,
    enabled: () => !!shown || (canInspect() && stops().length > 0),
    label: () => (shown ? t('gamepad.close') : t('gamepad.inspect')),
  });
  ffGamepadOn('back', () => show(undefined), {
    ...options,
    label: t('gamepad.close'),
  });
  FF_DIRECTIONS.forEach((direction) => {
    const step = direction === 'left' || direction === 'up' ? -1 : 1;
    ffGamepadOn(direction, () => show(cycleStep(stops(), shown, step)), {
      ...options,
      label: t('gamepad.browse'),
    });
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
