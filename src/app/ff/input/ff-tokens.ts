import { InjectionToken } from '@angular/core';
import type {
  FFButtonFeedback,
  FFControllerFamilyResolver,
  FFTextKeyboard,
} from '@ff/interfaces/ff-input';

export const FF_BUTTON_FEEDBACK = new InjectionToken<FFButtonFeedback>(
  'FF_BUTTON_FEEDBACK',
);

// Lets a host platform (e.g. Steamworks) name the physical pad behind a virtual one.
export const FF_CONTROLLER_FAMILY_RESOLVER =
  new InjectionToken<FFControllerFamilyResolver>(
    'FF_CONTROLLER_FAMILY_RESOLVER',
  );

// Lets a host platform (e.g. Steam's floating keyboard) supply typing for text fields.
export const FF_TEXT_KEYBOARD = new InjectionToken<FFTextKeyboard>(
  'FF_TEXT_KEYBOARD',
);
