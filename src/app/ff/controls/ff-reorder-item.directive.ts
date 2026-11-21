import {
  computed,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
} from '@angular/core';
import { FFReorderListDirective } from '@ff/controls/ff-reorder-list.directive';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';

// A row of an ffReorderList; X picks it up while focus is anywhere inside it.
@Directive({
  selector: '[ffReorderItem]',
  host: { '[class.ff-reorder-grabbed]': 'isGrabbed()' },
})
export class FFReorderItemDirective {
  private readonly list = inject(forwardRef(() => FFReorderListDirective));
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  // Pinned rows stay put.
  public ffReorderItemDisabled = input<boolean>(false);

  protected isGrabbed = computed(() => this.list.grab()?.item === this);

  constructor() {
    const host = this.host;
    ffGamepadOn('context', () => this.list.pickUp(this), {
      element: host,
      enabled: () =>
        !this.ffReorderItemDisabled() &&
        !this.list.grab() &&
        host.contains(document.activeElement),
      label: 'Move',
    });
  }
}
