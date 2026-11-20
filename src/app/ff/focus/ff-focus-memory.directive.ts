import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { FFFocusService } from '@ff/focus/ff-focus.service';

// Restores the last controller-focused element when this region becomes the visible one again.
@Directive({
  selector: '[ffFocusMemory]',
})
export class FFFocusMemoryDirective {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const unregister = inject(FFFocusService).registerMemoryRoot(host);
    inject(DestroyRef).onDestroy(unregister);
  }
}
