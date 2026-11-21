import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { FFSelectPopupService } from '@ff/controls/ff-select-popup.service';
import { ffNearestControlLabel } from '@ff/controls/ff-control-label';
import {
  ffSelectTitleFromPlaceholder,
  ffTitleCase,
} from '@ff/controls/ff-select-title';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import type { FFSelectPopupRequest } from '@ff/interfaces/ff-input';
import { NgSelectComponent } from '@ng-select/ng-select';

// Controller A on a focused ng-select opens the grid popup instead of its own dropdown; mouse use is unchanged.
@Directive({
  selector: 'ng-select[ffSelect]',
  host: { class: 'ff-select ff-focus-host' },
})
export class FFSelectDirective {
  private readonly select = inject(NgSelectComponent);
  private readonly popup = inject(FFSelectPopupService);
  private readonly element =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private request?: FFSelectPopupRequest;

  // Popup title; falls back to the placeholder, then the nearest label before the select.
  public ffSelect = input<string>('');

  constructor() {
    const element = this.element;
    ffGamepadOn('confirm', () => this.openPopup(), {
      element,
      enabled: () =>
        element.contains(document.activeElement) && !this.select.disabled(),
      label: 'Choose',
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.request) this.popup.closeIf(this.request);
    });
  }

  private title(): string | undefined {
    return (
      this.ffSelect() ||
      ffSelectTitleFromPlaceholder(this.select.placeholder()) ||
      ffTitleCase(ffNearestControlLabel(this.element) ?? '') ||
      undefined
    );
  }

  private openPopup(): void {
    const select = this.select;
    select.close();
    this.request = {
      title: this.title(),
      options: select.itemsList.items,
      optionTemplate: select.optionTemplate(),
      optgroupTemplate: select.optgroupTemplate(),
      pick: (option) => select.select(option),
      clear: this.clearOption(),
    };
    this.popup.open(this.request);
  }

  // Clearing is otherwise only reachable through ng-select's mouse-only X.
  private clearOption(): FFSelectPopupRequest['clear'] {
    const select = this.select;
    if (!select.clearable() || !select.hasValue) return undefined;
    return {
      label: select.placeholder() || 'None',
      run: () => select.handleClearClick(),
    };
  }
}
