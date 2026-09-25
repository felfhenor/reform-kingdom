import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';

@Directive({
  selector: 'button[appListRow]',
  host: {
    type: 'button',
    class:
      'btn btn-outline btn-neutral h-auto w-full justify-start gap-2 ps-0 normal-case font-normal text-sm text-start text-neutral-content aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
    '[class.btn-active]': 'listRowSelected()',
    '[attr.aria-disabled]': 'disabled() || null',
  },
})
export class ListRowDirective {
  public listRowSelected = input<boolean>(false);

  // Shadows the native [disabled] binding: a truly disabled button gets no mouse events, which kills the row's tooltip.
  public disabled = input<boolean>(false);

  constructor() {
    const element =
      inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;

    const blockDisabledClick = (event: MouseEvent) => {
      if (!this.disabled()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    // Capture listeners run before the host's own (click) handlers, so this blocks them outright.
    element.addEventListener('click', blockDisabledClick, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      element.removeEventListener('click', blockDisabledClick, {
        capture: true,
      }),
    );
  }
}
