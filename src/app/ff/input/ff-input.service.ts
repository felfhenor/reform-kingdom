import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { ffActionDispatch } from '@ff/input/ff-action-dispatch';
import { ffActionForButton, ffActionMap } from '@ff/input/ff-action-map';
import { ffControllerFamily } from '@ff/input/ff-controller-family';
import {
  ffAxesActive,
  ffButtonsJustPressed,
  ffButtonsJustReleased,
  ffGamepadMayTakeInput,
  ffGamepadSnapshot,
} from '@ff/input/ff-gamepad';
import type {
  FFActionHandler,
  FFActionHandlerOptions,
  FFActionRegistration,
  FFControllerFamily,
  FFGamepadAction,
  FFGamepadSnapshot,
  FFInputMode,
} from '@ff/interfaces/ff-input';

const MODE_SWITCH_DEADZONE = 0.5;
// Browsers send zero-movement mousemoves when the DOM under the cursor changes.
const MOUSE_MOVE_THRESHOLD = 3;
const GAMEPAD_TAKEOVER_MS = 250;

@Injectable({ providedIn: 'root' })
export class FFInputService {
  private readonly modeSignal = signal<FFInputMode>('kbm');
  private readonly familySignal = signal<FFControllerFamily>('xbox');

  public readonly mode = this.modeSignal.asReadonly();
  public readonly family = this.familySignal.asReadonly();

  private registrations: FFActionRegistration[] = [];
  private nextOrder = 0;
  private previousSnapshots = new Map<number, FFGamepadSnapshot>();
  private frameId?: number;
  private activeGamepadIndex?: number;
  private lastInputAt = 0;
  private heldButtonHandlers = new Map<string, FFActionRegistration>();

  constructor() {
    const listeners: Array<[string, EventListener]> = [
      ['gamepadconnected', this.startPolling],
      ['gamepaddisconnected', this.forgetGamepad as EventListener],
      ['keydown', this.useKeyboardMouse],
      ['pointerdown', this.useKeyboardMouse],
      ['mousemove', this.onMouseMove as EventListener],
    ];
    listeners.forEach(([name, listener]) =>
      window.addEventListener(name, listener),
    );

    inject(DestroyRef).onDestroy(() => {
      listeners.forEach(([name, listener]) =>
        window.removeEventListener(name, listener),
      );
      this.stopPolling();
    });

    effect(() => {
      document.documentElement.dataset['inputMode'] = this.mode();
    });

    // Pads connected before this service existed won't re-fire gamepadconnected.
    this.startPolling();
  }

  public register(
    action: FFGamepadAction,
    handler: FFActionHandler,
    options: FFActionHandlerOptions = {},
  ): () => void {
    const registration: FFActionRegistration = {
      action,
      handler,
      priority: options.priority ?? 0,
      order: this.nextOrder++,
      element: options.element,
      onRelease: options.onRelease,
    };
    this.registrations = [...this.registrations, registration];

    return () => {
      this.registrations = this.registrations.filter(
        (existing) => existing !== registration,
      );
      this.heldButtonHandlers.forEach((held, key) => {
        if (held === registration) this.heldButtonHandlers.delete(key);
      });
    };
  }

  private startPolling = (): void => {
    if (this.frameId !== undefined) return;
    this.frameId = requestAnimationFrame(this.poll);
  };

  private stopPolling(): void {
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
  }

  private forgetGamepad = (event: GamepadEvent): void => {
    const previous = this.previousSnapshots.get(event.gamepad.index);
    this.previousSnapshots.delete(event.gamepad.index);
    this.releaseButtons(
      event.gamepad.index,
      ffButtonsJustReleased(previous, { buttons: [], axes: [] }),
    );
  };

  private poll = (): void => {
    const gamepads = navigator
      .getGamepads()
      .filter(
        (gamepad): gamepad is Gamepad =>
          !!gamepad?.connected && gamepad.mapping === 'standard',
      );

    if (gamepads.length === 0) {
      this.stopPolling();
      return;
    }

    const now = performance.now();
    gamepads.forEach((gamepad) => this.pollGamepad(gamepad, now));
    this.frameId = requestAnimationFrame(this.poll);
  };

  private pollGamepad(gamepad: Gamepad, now: number): void {
    const snapshot = ffGamepadSnapshot(gamepad);
    const previous = this.previousSnapshots.get(gamepad.index);
    const pressed = ffButtonsJustPressed(previous, snapshot);
    this.previousSnapshots.set(gamepad.index, snapshot);

    this.releaseButtons(
      gamepad.index,
      ffButtonsJustReleased(previous, snapshot),
    );

    const hasInput =
      pressed.length > 0 || ffAxesActive(snapshot.axes, MODE_SWITCH_DEADZONE);
    if (!hasInput) return;

    const mayTakeInput = ffGamepadMayTakeInput(
      this.activeGamepadIndex,
      gamepad.index,
      now - this.lastInputAt,
      GAMEPAD_TAKEOVER_MS,
    );
    if (!mayTakeInput) return;

    this.activeGamepadIndex = gamepad.index;
    this.lastInputAt = now;
    this.modeSignal.set('gamepad');
    this.familySignal.set(ffControllerFamily(gamepad.id));

    const actionMap = ffActionMap(this.familySignal());
    pressed.forEach((button) => {
      const action = ffActionForButton(actionMap, button);
      if (action) this.pressButton(gamepad.index, button, action);
    });
  }

  private pressButton(
    gamepadIndex: number,
    button: number,
    action: FFGamepadAction,
  ): void {
    const handledBy = ffActionDispatch(this.registrations, action, (element) =>
      element.checkVisibility({ visibilityProperty: true }),
    );
    if (!handledBy?.onRelease) return;
    this.heldButtonHandlers.set(`${gamepadIndex}:${button}`, handledBy);
  }

  private releaseButtons(gamepadIndex: number, buttons: number[]): void {
    buttons.forEach((button) => {
      const key = `${gamepadIndex}:${button}`;
      const held = this.heldButtonHandlers.get(key);
      this.heldButtonHandlers.delete(key);
      held?.onRelease?.();
    });
  }

  private useKeyboardMouse = (): void => {
    this.modeSignal.set('kbm');
  };

  private onMouseMove = (event: MouseEvent): void => {
    const distance = Math.abs(event.movementX) + Math.abs(event.movementY);
    if (distance < MOUSE_MOVE_THRESHOLD) return;
    this.useKeyboardMouse();
  };
}
