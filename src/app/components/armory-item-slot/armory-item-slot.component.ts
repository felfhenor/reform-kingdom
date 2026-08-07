import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { InfusedMaterialsRowComponent } from '@components/infused-materials-row/infused-materials-row.component';
import { ItemStatRowsComponent } from '@components/item-stat-rows/item-stat-rows.component';
import { equipmentItemInfusionBonus, getEntry, partyGet } from '@helpers';
import type { EquipmentContent, EquipmentItem, JobContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-armory-item-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
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
}
