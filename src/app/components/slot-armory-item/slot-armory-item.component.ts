import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { getEntry } from '@helpers/content';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import {
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
  equipmentItemGrantedSkillIds,
} from '@helpers/item/equipment-display';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import { goldCoinId } from '@helpers/item/materials';
import { equipmentSellValue } from '@helpers/kingdom/armory';
import type {
  EquipmentContent,
  EquipmentItem,
  EquipmentSkillContent,
} from '@interfaces';
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

  public displayName = computed(() =>
    equipmentItemDisplayName(this.equipmentItem(), this.equipment().name),
  );

  public display = computed(() => ({
    ...itemPreviewDisplay(this.equipment(), 'equipment'),
    name: this.displayName(),
  }));

  public bonusStats = computed(() =>
    equipmentItemBonusStats(this.equipmentItem()),
  );

  public bonusResistances = computed(() =>
    equipmentItemBonusResistances(this.equipmentItem()),
  );

  public infusionSlotCount = computed(() =>
    equipmentItemSlotCount(this.equipmentItem()),
  );

  public grantedSkills = computed<EquipmentSkillContent[]>(() =>
    equipmentItemGrantedSkillIds(this.equipmentItem(), this.equipment())
      .map((skillId) => getEntry<EquipmentSkillContent>(skillId))
      .filter((skill): skill is EquipmentSkillContent => !!skill),
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
