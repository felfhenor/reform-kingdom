import { DestroyRef, inject } from '@angular/core';
import { FFInputService } from '@ff/input/ff-input.service';
import type {
  FFActionHandler,
  FFActionHandlerOptions,
  FFGamepadAction,
} from '@ff/interfaces/ff-input';

// Injection context only; unregisters with the caller's DestroyRef.
export function ffGamepadOn(
  action: FFGamepadAction,
  handler: FFActionHandler,
  options?: FFActionHandlerOptions,
): void {
  const unregister = inject(FFInputService).register(action, handler, options);
  inject(DestroyRef).onDestroy(unregister);
}
