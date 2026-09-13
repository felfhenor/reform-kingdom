import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import type { CostItem } from '@interfaces';

@Component({
  selector: 'app-row-currency-cost',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyCostComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      @for (cost of costs(); track cost.itemId) {
        <app-currency-cost [type]="cost.itemId" [amount]="cost.required" />
      }
    </div>
  `,
})
export class RowCurrencyCostComponent {
  public costs = input.required<CostItem[]>();
}
