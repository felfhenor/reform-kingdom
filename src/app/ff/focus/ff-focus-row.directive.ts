import { Directive, ElementRef, inject } from '@angular/core';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import { FFInputService } from '@ff/input/ff-input.service';

// A list row the D-pad stops on as a whole; its controls answer pad actions while it holds focus instead of being stops themselves.
@Directive({
  selector: '[ffFocusRow]',
  host: {
    class: 'ff-focus-row',
    '[attr.tabindex]': 'isGamepad() ? 0 : null',
  },
})
export class FFFocusRowDirective {
  private readonly ffInput = inject(FFInputService);
  public readonly element =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const element = this.element;
    // Clicking the row itself does nothing, so a row with no A action shouldn't advertise "Select".
    ffGamepadOn('confirm', () => undefined, {
      element,
      priority: -1,
      enabled: () => document.activeElement === element,
    });
  }

  protected isGamepad(): boolean {
    return this.ffInput.mode() === 'gamepad';
  }
}
