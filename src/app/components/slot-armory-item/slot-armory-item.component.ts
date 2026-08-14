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
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { equipmentSellValue } from '@helpers/armory';
import { getEntry } from '@helpers/content';
import { equipmentItemInfusionBonus } from '@helpers/infusion';
import { goldCoinId } from '@helpers/materials';
import { partyGet } from '@helpers/party';
import type { EquipmentContent, EquipmentItem, JobContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-armory-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CurrencyCostComponent,
    SlotIconBlankComponent,
    RowInfusedMaterialsComponent,
    RowItemStatsComponent,
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

  public equippableHeroes = computed(() =>
    partyGet()
      .filter((p) =>
        getEntry<JobContent>(p.jobId)!.equippableTypes.includes(
          this.equipment().type,
        ),
      )
      .map((h) => h.name),
  );

  public infusionBonus = computed(() =>
    equipmentItemInfusionBonus(this.equipmentItem().infusedItemIds),
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
