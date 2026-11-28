import { t } from '@helpers/i18n/i18n';
import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { ffNearestControlLabel } from '@ff/controls/ff-control-label';
import { FFFocusRowDirective } from '@ff/focus/ff-focus-row.directive';
import { FFNumberPopupService } from '@ff/controls/ff-number-popup.service';
import { ffTitleCase } from '@ff/controls/ff-select-title';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import type { FFNumberPopupRequest } from '@ff/interfaces/ff-input';

function ffNumberAttribute(value: string): number | undefined {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Controller A on a focused number/range input opens the number popup; the D-pad otherwise moves past it as usual.
@Directive({
  selector: 'input[ffStepper]',
})
export class FFStepperDirective {
  private readonly host =
    inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly popup = inject(FFNumberPopupService);

  private request?: FFNumberPopupRequest;

  // Popup title; falls back to the nearest label before the input.
  public ffStepper = input<string>('');

  constructor() {
    const host = this.host;
    const row = inject(FFFocusRowDirective, { optional: true })?.element;
    ffGamepadOn('confirm', () => this.openPopup(), {
      element: row ?? host,
      enabled: () =>
        !host.disabled &&
        (row
          ? row.contains(document.activeElement)
          : document.activeElement === host),
      label: t('gamepad.edit'),
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.request) this.popup.closeIf(this.request);
    });
  }

  private openPopup(): void {
    const host = this.host;
    this.request = {
      title:
        this.ffStepper() ||
        ffTitleCase(ffNearestControlLabel(host) ?? '') ||
        undefined,
      value: ffNumberAttribute(host.value) ?? ffNumberAttribute(host.min) ?? 0,
      min: ffNumberAttribute(host.min),
      max: ffNumberAttribute(host.max),
      step: ffNumberAttribute(host.step) ?? 1,
      commit: (value) => this.commit(value),
    };
    this.popup.open(this.request);
  }

  // Fires the same events typing or dragging would, so existing (input)/(change) bindings pick it up.
  private commit(value: number): void {
    this.host.value = String(value);
    this.host.dispatchEvent(new Event('input', { bubbles: true }));
    this.host.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
