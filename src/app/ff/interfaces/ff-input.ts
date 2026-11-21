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
