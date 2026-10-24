import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { getEntry } from '@helpers/content/content';
import { goldCoinId } from '@helpers/item/materials';
import { equipmentSellValue } from '@helpers/kingdom/armory';
import type { EquipmentContent, EquipmentItem } from '@interfaces';

@Component({
  selector: 'app-row-equipment-sell-value',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyCostComponent],
  template: `
    @let value = sellValue();
    @if (value !== undefined) {
      <div class="text-xs my-2 flex items-center gap-2">
        Sell value:
        <app-currency-cost [type]="goldCoinItemId" [amount]="value" />
      </div>
    }
  `,
})
export class RowEquipmentSellValueComponent {
  public item = input.required<EquipmentItem>();

  public goldCoinItemId = goldCoinId();

  public sellValue = computed(() => {
    const item = this.item();
    const content = getEntry<EquipmentContent>(item.equipmentId);
    return content ? equipmentSellValue({ item, content }) : undefined;
  });
}
