import { ChangeDetectionStrategy, Component } from '@angular/core';
import { kingdomSubviewClear } from '@helpers';

@Component({
  selector: 'app-kingdom-back-button',
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
export class KingdomBackButtonComponent {
  public back(): void {
    kingdomSubviewClear();
  }
}
