import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import type { ItemId } from '@interfaces';

@Component({
  selector: 'app-row-currency-cost',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyCostComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      @for (cost of costs(); track cost.type) {
        <app-currency-cost [type]="cost.type" [amount]="cost.amount" />
      }
    </div>
  `,
})
export class RowCurrencyCostComponent {
  public costs = input.required<{ type: ItemId; amount: number }[]>();
}
