import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import {
  ffActionDispatch,
  ffActivePrompts,
} from '@ff/input/ff-action-dispatch';
import {
  FF_DIRECTIONS,
  ffActionForButton,
  ffActionMap,
} from '@ff/input/ff-action-map';
import { ffControllerFamily } from '@ff/input/ff-controller-family';
import {
  ffAxesActive,
  ffButtonsJustPressed,
  ffButtonsJustReleased,
  ffGamepadMayTakeInput,
  ffGamepadSnapshot,
  ffHeldDirection,
  ffRepeatFires,
} from '@ff/input/ff-gamepad';
import { FF_CONTROLLER_FAMILY_RESOLVER } from '@ff/input/ff-tokens';
import type {
  FFActionHandler,
  FFActionHandlerOptions,
  FFActionRegistration,
  FFControllerFamily,
  FFDirection,
  FFGamepadAction,
  FFGamepadSnapshot,
  FFInputMode,
  FFPrompt,
} from '@ff/interfaces/ff-input';

const MODE_SWITCH_DEADZONE = 0.5;
// Browsers send zero-movement mousemoves when the DOM under the cursor changes.
const MOUSE_MOVE_THRESHOLD = 3;
const GAMEPAD_TAKEOVER_MS = 250;
const PROMPT_REFRESH_MS = 200;
const FAMILY_RESOLVE_RETRY_MS = 2000;
const DIRECTION_REPEAT_DELAY_MS = 400;
const DIRECTION_REPEAT_INTERVAL_MS = 120;

const PROMPT_ACTION_ORDER: FFGamepadAction[] = [
  'confirm',
  'back',
  'context',
  'details',
  'tabPrev',
  'tabNext',
  'subPrev',
  'subNext',
  'recenter',
  'pause',
  'menu',
  'left',
  'right',
  'up',
  'down',
];

@Injectable({ providedIn: 'root' })
export class FFInputService {
  private readonly modeSignal = signal<FFInputMode>('kbm');
  private readonly familySignal = signal<FFControllerFamily>('xbox');
  private readonly promptsSignal = signal<FFPrompt[]>([]);
  private readonly familyResolver = inject(FF_CONTROLLER_FAMILY_RESOLVER, {
    optional: true,
  });

  public readonly mode = this.modeSignal.asReadonly();
  public readonly family = this.familySignal.asReadonly();
  public readonly prompts = this.promptsSignal.asReadonly();

  private registrations: FFActionRegistration[] = [];
  private nextOrder = 0;
  private previousSnapshots = new Map<number, FFGamepadSnapshot>();
  private frameId?: number;
  private activeGamepadIndex?: number;
  private lastInputAt = 0;
  private heldButtonHandlers = new Map<string, FFActionRegistration>();
  private resolvedFamilies = new Map<number, FFControllerFamily>();
  private lastFamilyResolveAt = new Map<number, number>();
  private lastPromptRefreshAt = 0;
  private refreshListeners: Array<() => void> = [];
  private elementFilter?: (element: HTMLElement) => boolean;
  private heldDirection?: FFDirection;
  private heldDirectionSince = 0;
  private heldDirectionFires = 0;

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
      document.documentElement.classList.toggle(
        'ff-input-gamepad',
        this.mode() === 'gamepad',
      );
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
      ...options,
      action,
      handler,
      priority: options.priority ?? 0,
      order: this.nextOrder++,
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

  // How long the current D-pad/stick direction has been held, for controls that accelerate.
  public heldDirectionMs(): number {
    return this.heldDirection ? performance.now() - this.heldDirectionSince : 0;
  }

  // Lets focus scoping (modals, dialogs, tutorials) silence element-bound handlers underneath.
  public setElementFilter(
    filter: (element: HTMLElement) => boolean,
  ): () => void {
    this.elementFilter = filter;
    return () => {
      if (this.elementFilter === filter) this.elementFilter = undefined;
    };
  }

  private isElementActive = (element: HTMLElement): boolean =>
    element.checkVisibility({ visibilityProperty: true }) &&
    (this.elementFilter?.(element) ?? true);

  // Runs on the prompt cadence while in gamepad mode, for state that isn't reactive (DOM visibility).
  public onRefresh(listener: () => void): () => void {
    this.refreshListeners = [...this.refreshListeners, listener];
    return () => {
      this.refreshListeners = this.refreshListeners.filter(
        (existing) => existing !== listener,
      );
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
    this.resolvedFamilies.delete(event.gamepad.index);
    this.lastFamilyResolveAt.delete(event.gamepad.index);
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
    this.refreshPrompts(now);
    this.frameId = requestAnimationFrame(this.poll);
  };

  private refreshPrompts(now: number): void {
    if (this.mode() !== 'gamepad') return;
    if (now - this.lastPromptRefreshAt < PROMPT_REFRESH_MS) return;

    this.lastPromptRefreshAt = now;
    this.refreshListeners.forEach((listener) => listener());
    this.promptsSignal.set(
      ffActivePrompts(
        this.registrations,
        PROMPT_ACTION_ORDER,
        this.isElementActive,
      ),
    );
  }

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
    if (hasInput && this.takeInput(gamepad, now)) {
      this.pressButtons(gamepad.index, pressed);
    }
    if (gamepad.index === this.activeGamepadIndex) {
      this.repeatDirection(snapshot, now);
    }
  }

  private takeInput(gamepad: Gamepad, now: number): boolean {
    const mayTakeInput = ffGamepadMayTakeInput(
      this.activeGamepadIndex,
      gamepad.index,
      now - this.lastInputAt,
      GAMEPAD_TAKEOVER_MS,
    );
    if (!mayTakeInput) return false;

    this.resolveFamily(gamepad, now);
    this.activeGamepadIndex = gamepad.index;
    this.lastInputAt = now;
    this.modeSignal.set('gamepad');
    this.familySignal.set(
      this.resolvedFamilies.get(gamepad.index) ??
        ffControllerFamily(gamepad.id),
    );

    return true;
  }

  // Directions are dispatched by repeatDirection instead, so holding them repeats.
  private pressButtons(gamepadIndex: number, pressed: number[]): void {
    const actionMap = ffActionMap(this.familySignal());
    pressed.forEach((button) => {
      const action = ffActionForButton(actionMap, button);
      if (!action || FF_DIRECTIONS.includes(action as FFDirection)) return;
      this.pressButton(gamepadIndex, button, action);
    });
  }

  private repeatDirection(snapshot: FFGamepadSnapshot, now: number): void {
    const direction = ffHeldDirection(
      snapshot,
      ffActionMap(this.familySignal()),
      MODE_SWITCH_DEADZONE,
    );
    if (direction !== this.heldDirection) {
      this.heldDirection = direction;
      this.heldDirectionSince = now;
      this.heldDirectionFires = 0;
    }
    if (!direction) return;

    const owed = ffRepeatFires(
      now - this.heldDirectionSince,
      DIRECTION_REPEAT_DELAY_MS,
      DIRECTION_REPEAT_INTERVAL_MS,
    );
    if (this.heldDirectionFires >= owed) return;

    this.heldDirectionFires += 1;
    this.lastInputAt = now;
    this.dispatch(direction);
  }

  private dispatch(action: FFGamepadAction): FFActionRegistration | undefined {
    this.lastPromptRefreshAt = 0;
    return ffActionDispatch(this.registrations, action, this.isElementActive);
  }

  private pressButton(
    gamepadIndex: number,
    button: number,
    action: FFGamepadAction,
  ): void {
    const handledBy = this.dispatch(action);
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

  // Retries until resolved, since a platform resolver may not see the pad yet.
  private resolveFamily(gamepad: Gamepad, now: number): void {
    if (!this.familyResolver || this.resolvedFamilies.has(gamepad.index))
      return;

    const lastAttempt = this.lastFamilyResolveAt.get(gamepad.index);
    if (
      lastAttempt !== undefined &&
      now - lastAttempt < FAMILY_RESOLVE_RETRY_MS
    ) {
      return;
    }

    this.lastFamilyResolveAt.set(gamepad.index, now);
    void this.familyResolver()
      .then((family) => {
        if (!family) return;

        this.resolvedFamilies.set(gamepad.index, family);
        if (this.activeGamepadIndex === gamepad.index) {
          this.familySignal.set(family);
        }
      })
      .catch(() => undefined);
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
