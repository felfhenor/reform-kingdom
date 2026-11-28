import { t } from '@helpers/i18n/i18n';
import {
  afterNextRender,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  untracked,
} from '@angular/core';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { FFInputService } from '@ff/input/ff-input.service';

// Above page-level back, so B walks back up a pick chain before leaving the page.
const STEP_BACK_PRIORITY = 5;

// On the "next" list of a pick chain (hero -> items -> slots): when the key it watches changes from a
// controller press, focus moves into this list, and B returns to whatever made the pick.
@Directive({
  selector: '[ffFocusOnChange]',
})
export class FFFocusOnChangeDirective {
  public ffFocusOnChange = input<unknown>();
  // For lists that only appear once the pick is made, so their first render counts as the change.
  public ffFocusOnCreate = input<boolean>(false);
  // Raise inside a modal, so B steps back out of the list before it closes the modal.
  public ffFocusOnChangePriority = input<number>(STEP_BACK_PRIORITY);

  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly focus = inject(FFFocusService);
  private readonly ffInput = inject(FFInputService);
  private previous?: HTMLElement;

  constructor() {
    let initialized = false;
    effect(() => {
      this.ffFocusOnChange();
      const isFirstRun = !initialized;
      initialized = true;
      if (isFirstRun && !untracked(this.ffFocusOnCreate)) return;
      untracked(() => this.enter());
    });

    // Re-registered when the priority input arrives; inputs aren't set in the constructor.
    effect((onCleanup) => {
      const unregister = this.ffInput.register('back', () => this.stepBack(), {
        element: this.host,
        priority: this.ffFocusOnChangePriority(),
        enabled: () => this.canStepBack(),
        label: t('gamepad.back'),
      });
      onCleanup(unregister);
    });
  }

  private enter(): void {
    if (this.ffInput.mode() !== 'gamepad' || this.focus.isFocusOnChangeHeld()) {
      return;
    }

    const active = document.activeElement;
    this.previous =
      active instanceof HTMLElement && !this.host.contains(active)
        ? active
        : this.previous;
    afterNextRender(() => this.focus.focusLanding(this.host), {
      injector: this.injector,
    });
  }

  private canStepBack(): boolean {
    const active = document.activeElement;
    return (
      !!this.previous &&
      active instanceof HTMLElement &&
      this.host.contains(active) &&
      this.focus.isFocusable(this.previous)
    );
  }

  private stepBack(): void {
    if (this.previous) this.focus.focusElement(this.previous);
  }
}
