import type { TemplateRef } from '@angular/core';
import type { NgOption } from '@ng-select/ng-select';

export type FFInputMode = 'kbm' | 'gamepad';

export type FFControllerFamily =
  | 'xbox'
  | 'playstation'
  | 'switch'
  | 'switch2'
  | 'steam-controller'
  | 'steam-deck';

// 'dpad' is prompt-only: it stands for all four directions at once and is never pressed.
export type FFGamepadAction =
  | 'dpad'
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
  | 'zone'
  | FFDirection;

export type FFDirection = 'up' | 'down' | 'left' | 'right';

export type FFAxis = 'x' | 'y';

export interface FFRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FFFocusScopeRegistration {
  priority: number;
  order: number;
  resolve: () => HTMLElement | null;
  autoFocus: boolean;
}

export interface FFFocusEdgeDetail {
  direction: FFDirection;
}

export type FFActionMap = Record<FFGamepadAction, number>;

export interface FFGamepadSnapshot {
  buttons: boolean[];
  axes: number[];
}

// Return false to pass the action on to the next handler.
export type FFActionHandler = () => boolean | void;

// A font glyph and its ink height in font units, used to center it vertically.
export interface FFGlyphCode {
  code: number;
  inkHeight: number;
}

export interface FFGlyph {
  text: string;
  lineHeightEm: number;
}

export type FFPromptLabel = string | (() => string);

export interface FFActionHandlerOptions {
  priority?: number;
  element?: HTMLElement;
  onRelease?: () => void;
  // Read by the prompt bar too, so it must be side-effect free.
  enabled?: () => boolean;
  label?: FFPromptLabel;
}

export interface FFActionRegistration extends FFActionHandlerOptions {
  action: FFGamepadAction;
  handler: FFActionHandler;
  priority: number;
  order: number;
}

export interface FFPrompt {
  actions: FFGamepadAction[];
  label: string;
}

export interface FFButtonFeedback {
  click: (sound: string, offset: number) => void;
  hover: (offset: number) => void;
}

export type FFControllerFamilyResolver = () => Promise<
  FFControllerFamily | undefined
>;

export interface FFSelectOptionGroup {
  header?: NgOption;
  items: NgOption[];
}

export interface FFSelectPopupRequest {
  title?: string;
  options: NgOption[];
  optionTemplate?: TemplateRef<unknown>;
  optgroupTemplate?: TemplateRef<unknown>;
  pick: (option: NgOption) => void;
  clear?: { label: string; run: () => void };
}

export interface FFReorderGrab {
  item: unknown;
  from: number;
  at: number;
  focused?: HTMLElement;
}

export interface FFReorderMove {
  fromIndex: number;
  toIndex: number;
}

// Opens a platform on-screen keyboard over the given text field; false when none could be shown.
export type FFTextKeyboard = (field: FFRect) => Promise<boolean>;

export interface FFNumberBounds {
  min?: number;
  max?: number;
  step: number;
}

export interface FFNumberPopupRequest extends FFNumberBounds {
  title?: string;
  value: number;
  commit: (value: number) => void;
}
