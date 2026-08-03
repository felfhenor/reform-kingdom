import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyNameComponent } from '@components/currency-name/currency-name.component';
import type { ItemId } from '../../interfaces';

@Component({
  selector: 'app-currency-cost',
  imports: [CurrencyNameComponent],
  template: `
    <app-currency-name
      [type]="type()"
      [short]="true"
      [amount]="amount()"
      [minWidth]="minWidth()"
      [numberFormat]="numberFormat()"
    />
  `,
  host: {
    class: 'inline-flex items-center',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyCostComponent {
  public type = input.required<ItemId>();
  public amount = input.required<number>();
  public minWidth = input('');
  public numberFormat = input('1.0-0');
}
