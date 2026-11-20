import { Directive, ElementRef, inject } from '@angular/core';
import { FFFocusService } from '@ff/focus/ff-focus.service';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';

// Tab strips outrank other page-level LT/RT bindings, such as grid paging.
const TAB_STRIP_PRIORITY = 1;

const SELECTED_TAB_SELECTOR =
  '[fftriggertabs] [role="tab"][aria-selected="true"]';

// LT/RT step through a role="tablist" (tabs mark the current one with aria-selected), moving focus along.
@Directive({
  selector: '[ffTriggerTabs]',
})
export class FFTriggerTabsDirective {
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly focus = inject(FFFocusService);

  constructor() {
    const options = {
      element: this.host,
      priority: TAB_STRIP_PRIORITY,
      enabled: () => this.tabs().length > 1,
      label: 'Switch Tab',
    };
    ffGamepadOn('subPrev', () => this.step(-1), options);
    ffGamepadOn('subNext', () => this.step(1), options);
  }

  private tabs(): HTMLElement[] {
    return [...this.host.querySelectorAll<HTMLElement>('[role="tab"]')].filter(
      (tab) =>
        !tab.hasAttribute('disabled') &&
        tab.checkVisibility({ visibilityProperty: true }),
    );
  }

  private step(direction: 1 | -1): void {
    const tabs = this.tabs();
    const current = tabs.findIndex(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    );
    const next = tabs[(current + direction + tabs.length) % tabs.length];
    next.click();
    // A tab switch may re-render the whole tablist, so find the selected tab again afterwards.
    requestAnimationFrame(() => {
      const selected = [
        ...document.querySelectorAll<HTMLElement>(SELECTED_TAB_SELECTOR),
      ].find((tab) => tab.checkVisibility({ visibilityProperty: true }));
      if (selected) this.focus.focusElement(selected);
    });
  }
}
