import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { InfusedMaterialsRowComponent } from '@components/infused-materials-row/infused-materials-row.component';
import { ItemStatRowsComponent } from '@components/item-stat-rows/item-stat-rows.component';
import {
  equipmentItemInfusionBonus,
  equipmentSellValue,
  getEntry,
  goldCoinId,
  partyGet,
} from '@helpers';
import type { EquipmentContent, EquipmentItem, JobContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-armory-item-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CurrencyCostComponent,
    IconBlankSlotComponent,
    InfusedMaterialsRowComponent,
    ItemStatRowsComponent,
    TippyDirective,
  ],
  templateUrl: './armory-item-slot.component.html',
  styleUrl: './armory-item-slot.component.scss',
})
export class ArmoryItemSlotComponent {
  public equipment = input.required<EquipmentContent>();
  public equipmentItem = input.required<EquipmentItem>();
  public sellMode = input(false);
  public selected = input(false);

  public toggleSelect = output<void>();

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
    equipmentSellValue({ item: this.equipmentItem(), content: this.equipment() }),
  );

  public onClick(): void {
    if (!this.sellMode()) return;
    this.toggleSelect.emit();
  }
}
