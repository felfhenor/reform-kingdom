import { DestroyRef, effect, inject } from '@angular/core';
import { ffStepNumber } from '@ff/controls/ff-number-step';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { ffActionMap } from '@ff/input/ff-action-map';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import { ffCreateGlyphElement } from '@ff/input/ff-glyphs';
import { FFInputService } from '@ff/input/ff-input.service';
import { FF_TEXT_KEYBOARD } from '@ff/input/ff-tokens';
import type { FFGamepadAction } from '@ff/interfaces/ff-input';
import { GAMEPAD_PRIORITY } from '@helpers/engine/gamepad.ui';
import { SweetAlert2LoaderService } from '@sweetalert2/ngx-sweetalert2';
import type Swal from 'sweetalert2';

// Fixed button -> pad action, so a dialog never needs focus moved around it.
const SWAL_BUTTON_ACTIONS: Array<[string, FFGamepadAction]> = [
  ['.swal2-confirm', 'confirm'],
  ['.swal2-cancel', 'back'],
  ['.swal2-deny', 'context'],
];

// Nothing behind or inside the dialog moves while it's open; left/right/LT/RT are taken back for number inputs.
const SWAL_BLOCKED_ACTIONS: FFGamepadAction[] = [
  'up',
  'down',
  'left',
  'right',
  'tabPrev',
  'tabNext',
  'subPrev',
  'subNext',
  'details',
  'pause',
  'menu',
  'recenter',
];

const SWAL_FAST_STEPS = 10;

// A closing swal keeps its container until the hide animation ends.
export function gamepadSwalShown(): boolean {
  return !!gamepadSwalPopup();
}

function gamepadSwalPopup(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '.swal2-container:not(.swal2-backdrop-hide) .swal2-popup',
  );
}

// Swal keeps unused buttons in the DOM, hidden with display:none.
function gamepadSwalButton(selector: string): HTMLElement | undefined {
  const button = gamepadSwalPopup()?.querySelector<HTMLElement>(selector);
  return button?.checkVisibility() ? button : undefined;
}

function gamepadSwalInput(type: string): HTMLInputElement | undefined {
  const input = gamepadSwalPopup()?.querySelector<HTMLInputElement>(
    `input.swal2-input[type="${type}"]`,
  );
  return input?.checkVisibility() ? input : undefined;
}

function gamepadSwalStep(steps: number): void {
  const input = gamepadSwalInput('number');
  if (!input) return;

  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const bounds = {
    min: Number.isFinite(min) ? min : undefined,
    max: Number.isFinite(max) ? max : undefined,
    step: 1,
  };
  const current = parseFloat(input.value);
  const value = Number.isFinite(current) ? current : (bounds.min ?? 0);
  input.value = String(ffStepNumber(value, steps, bounds));
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

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

function gamepadBindSwalButtons(loader: SweetAlert2LoaderService): void {
  const dialog = {
    priority: GAMEPAD_PRIORITY.dialog,
    enabled: gamepadSwalShown,
  };
  const click = (press: (swal: typeof Swal) => void) =>
    void loader.swal.then(press);

  SWAL_BLOCKED_ACTIONS.forEach((action) =>
    ffGamepadOn(action, () => undefined, dialog),
  );
  ffGamepadOn('confirm', () => click((swal) => swal.clickConfirm()), {
    ...dialog,
    label: 'Confirm',
  });
  ffGamepadOn('back', () => click((swal) => swal.clickCancel()), {
    ...dialog,
    label: 'Cancel',
  });
  ffGamepadOn('context', () => click((swal) => swal.clickDeny()), {
    ...dialog,
    enabled: () => !!gamepadSwalButton('.swal2-deny'),
    label: () => gamepadSwalButton('.swal2-deny')?.textContent?.trim() ?? '',
  });
}

function gamepadBindSwalInputs(): void {
  const priority = GAMEPAD_PRIORITY.dialog;
  const hasNumber = () => !!gamepadSwalInput('number');
  const adjust = { priority, enabled: hasNumber, label: 'Adjust' };
  ffGamepadOn('left', () => gamepadSwalStep(-1), adjust);
  ffGamepadOn('right', () => gamepadSwalStep(1), adjust);
  const fast = { priority, enabled: hasNumber, label: '±10' };
  ffGamepadOn('subPrev', () => gamepadSwalStep(-SWAL_FAST_STEPS), fast);
  ffGamepadOn('subNext', () => gamepadSwalStep(SWAL_FAST_STEPS), fast);

  const keyboard = inject(FF_TEXT_KEYBOARD, { optional: true });
  if (!keyboard) return;

  ffGamepadOn(
    'details',
    () => {
      const input = gamepadSwalInput('text');
      if (!input) return;
      input.focus();
      void keyboard(input.getBoundingClientRect());
    },
    { priority, enabled: () => !!gamepadSwalInput('text'), label: 'Type' },
  );
}

// Injection context only: A/B/X press confirm/cancel/deny with glyphs shown, so focus never needs to move inside a swal.
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

  gamepadBindSwalButtons(inject(SweetAlert2LoaderService));
  gamepadBindSwalInputs();

  // Still a scope, so element-bound handlers behind the dialog go quiet.
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
