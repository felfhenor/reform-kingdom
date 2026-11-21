import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import { FFFocusRowDirective } from '@ff/focus/ff-focus-row.directive';
import { FFInputService } from '@ff/input/ff-input.service';
import type { FFGamepadAction } from '@ff/interfaces/ff-input';

// ffButton's pad action for non-button controls (e.g. a row's checkbox): pressing it clicks the control while its row has focus.
@Directive({
  selector: 'input[ffPadAction]',
})
export class FFPadActionDirective {
  private readonly host =
    inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly row = inject(FFFocusRowDirective, { optional: true });
  private readonly ffInput = inject(FFInputService);

  public ffPadAction = input.required<FFGamepadAction>();
  public ffPadLabel = input<string>('');

  constructor() {
    const host = this.host;
    const scope = this.row?.element ?? host;
    effect((onCleanup) => {
      const unregister = this.ffInput.register(
        this.ffPadAction(),
        () => host.click(),
        {
          element: scope,
          enabled: () =>
            !host.disabled && scope.contains(document.activeElement),
          label: this.ffPadLabel(),
        },
      );
      onCleanup(unregister);
    });
  }
}
