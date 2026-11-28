import { t } from '@helpers/i18n/i18n';
import { Directive, ElementRef, inject } from '@angular/core';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import { FF_TEXT_KEYBOARD } from '@ff/input/ff-tokens';

// Controller A on a focused text field opens the platform's on-screen keyboard, when the host provides one.
@Directive({
  selector: 'input[ffKeyboard], textarea[ffKeyboard]',
})
export class FFKeyboardDirective {
  constructor() {
    const keyboard = inject(FF_TEXT_KEYBOARD, { optional: true });
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (!keyboard) return;

    ffGamepadOn('confirm', () => void keyboard(host.getBoundingClientRect()), {
      element: host,
      enabled: () => document.activeElement === host,
      label: t('gamepad.type'),
    });
  }
}
