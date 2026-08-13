import { ChangeDetectionStrategy, Component } from '@angular/core';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-button-kingdom-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <button
      class="btn btn-sm btn-neutral btn-outline text-neutral-content"
      (click)="back()"
    >
      Back
    </button>
  `,
})
export class ButtonKingdomBackComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
