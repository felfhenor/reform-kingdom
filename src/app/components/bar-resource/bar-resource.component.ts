import { Component, computed } from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { getEntry } from '@helpers/content';
import { getMaterialQuantity } from '@helpers/item/materials';
import type { ItemContent } from '../../interfaces';

@Component({
  selector: 'app-bar-resource',
  imports: [CurrencyCostComponent],
  templateUrl: './bar-resource.component.html',
})
export class BarResourceComponent {
  public resources = computed(() => {
    const goldCoinEntry = getEntry<ItemContent>('Gold Coin')!;

    return [
      { itemRef: goldCoinEntry, total: getMaterialQuantity(goldCoinEntry.id) },
    ];
  });

  public areAnyGreaterThanZero = computed(() => {
    return this.resources().some((r) => r.total > 0);
  });
}
