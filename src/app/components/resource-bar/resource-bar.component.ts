import { Component, computed } from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { getEntry, getMaterialQuantity } from '../../helpers';
import type { ItemContent } from '../../interfaces';

@Component({
  selector: 'app-resource-bar',
  imports: [CurrencyCostComponent],
  templateUrl: './resource-bar.component.html',
})
export class ResourceBarComponent {
  public resources = computed(() => {
    const goldCoinEntry = getEntry<ItemContent>('Gold Coin')!;

    return [
      { itemRef: goldCoinEntry, total: getMaterialQuantity(goldCoinEntry.id) },
    ];
  });
}
