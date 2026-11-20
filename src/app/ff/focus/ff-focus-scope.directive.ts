import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import { FFFocusService } from '@ff/focus/ff-focus.service';

// While visible, controller focus stays inside the highest-priority scope.
@Directive({
  selector: '[ffFocusScope]',
})
export class FFFocusScopeDirective {
  public ffFocusScope = input<number>(0);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const focus = inject(FFFocusService);

    effect((onCleanup) => {
      const unregisterScope = focus.registerScope(
        this.ffFocusScope(),
        () => host,
      );
      const unregisterRoot = focus.registerMemoryRoot(host);
      onCleanup(() => {
        unregisterScope();
        unregisterRoot();
      });
    });
  }
}
