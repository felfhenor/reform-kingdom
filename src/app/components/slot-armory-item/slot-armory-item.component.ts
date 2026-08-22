import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { equipmentSellValue } from '@helpers/armory';
import {
  equipmentItemInfusionBonus,
  equipmentItemInfusionResistanceBonus,
} from '@helpers/infusion';
import { itemPreviewDisplay } from '@helpers/item-preview';
import { goldCoinId } from '@helpers/materials';
import type { EquipmentContent, EquipmentItem } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-armory-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CurrencyCostComponent,
    SlotIconBlankComponent,
    RowInfusedMaterialsComponent,
    TooltipItemPreviewComponent,
    TippyDirective,
  ],
  templateUrl: './slot-armory-item.component.html',
  styleUrl: './slot-armory-item.component.scss',
})
export class SlotArmoryItemComponent {
  public equipment = input.required<EquipmentContent>();
  public equipmentItem = input.required<EquipmentItem>();
  public sellMode = input(false);
  public selected = input(false);

  public toggleSelect = output<MouseEvent>();

  public goldCoinItemId = goldCoinId();

  public display = computed(() =>
    itemPreviewDisplay(this.equipment(), 'equipment'),
  );

  public infusionBonus = computed(() =>
    equipmentItemInfusionBonus(this.equipmentItem().infusedItemIds),
  );

  public infusionResistanceBonus = computed(() =>
    equipmentItemInfusionResistanceBonus(this.equipmentItem().infusedItemIds),
  );

  public sellValue = computed(() =>
    equipmentSellValue({
      item: this.equipmentItem(),
      content: this.equipment(),
    }),
  );

  public onClick(event: MouseEvent): void {
    if (!this.sellMode()) return;
    this.toggleSelect.emit(event);
  }
}
