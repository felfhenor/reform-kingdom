import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { kingdomSubviewClear } from '@helpers/engine/ui';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-button-kingdom-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TippyDirective, FFButtonComponent, IconComponent],
  template: `
    <button
      class="btn btn-sm btn-neutral btn-outline text-neutral-content"
      tp="Go Back [BACKSPACE]"
      (click)="back()"
      ffButton="ui-error"
      ffHotkey="BACKSPACE"
      ffPadAction="back"
      ffPadLabel="Back"
    >
      <app-icon name="tablerArrowLeft" class="text-lg" />
    </button>
  `,
})
export class ButtonKingdomBackComponent {
  // Subviews outside the Kingdom tab (e.g. the Heroes regalia page) pass their own exit.
  public onBack = input<() => void>(kingdomSubviewClear);

  public back(): void {
    this.onBack()();
  }
}
