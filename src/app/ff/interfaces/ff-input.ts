export type FFInputMode = 'kbm' | 'gamepad';

export type FFControllerFamily =
  | 'xbox'
  | 'playstation'
  | 'switch'
  | 'switch2'
  | 'steam-controller'
  | 'steam-deck';

export type FFGamepadAction =
  | 'confirm'
  | 'back'
  | 'context'
  | 'details'
  | 'tabPrev'
  | 'tabNext'
  | 'subPrev'
  | 'subNext'
  | 'pause'
  | 'menu'
  | 'recenter'
  | 'up'
  | 'down'
  | 'left'
  | 'right';

export type FFActionMap = Record<FFGamepadAction, number>;

export interface FFGamepadSnapshot {
  buttons: boolean[];
  axes: number[];
}

// Return false to pass the action on to the next handler.
export type FFActionHandler = () => boolean | void;

export interface FFActionHandlerOptions {
  priority?: number;
  element?: HTMLElement;
  onRelease?: () => void;
}

export interface FFActionRegistration {
  action: FFGamepadAction;
  handler: FFActionHandler;
  priority: number;
  order: number;
  element?: HTMLElement;
  onRelease?: () => void;
}
