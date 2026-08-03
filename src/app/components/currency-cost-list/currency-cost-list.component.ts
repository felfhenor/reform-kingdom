import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { ItemId } from '../../interfaces';
import { CurrencyCostComponent } from '../currency-cost/currency-cost';

@Component({
  selector: 'app-currency-cost-list',
  imports: [CurrencyCostComponent],
  template: `
    @for (entry of entries(); track entry.type) {
      <app-currency-cost [type]="entry.type" [amount]="entry.amount" />
    }
  `,
  host: {
    class: 'inline-flex items-center gap-2 flex-wrap',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyCostListComponent {
  public cost = input.required<number>();

  public entries = computed(() => {
    return Object.entries(this.cost())
      .filter(([, v]) => v && v > 0)
      .map(([type, v]) => ({ type: type as ItemId, amount: v! }));
  });
}
