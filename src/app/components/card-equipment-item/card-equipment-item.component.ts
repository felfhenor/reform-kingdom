import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import { equipmentItemBonusStats } from '@helpers/item/equipment-display';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  itemPreviewTotalCombatStats,
  itemPreviewTotalMonsterTypeDamage,
  itemPreviewTotalResistances,
  itemPreviewTotalStats,
} from '@helpers/item/item-preview.ui';
import type {
  EquipmentContent,
  EquipmentItem,
  ItemPreviewDisplay,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-card-equipment-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotRarityOutlineComponent,
    RowInfusedMaterialsComponent,
    RowItemStatsComponent,
    DetailItemPreviewComponent,
    TippyDirective,
    ListRowDirective,
    SFXDirective,
  ],
  templateUrl: './card-equipment-item.component.html',
  styleUrl: './card-equipment-item.component.scss',
})
export class CardEquipmentItemComponent {
  public equipment = input.required<EquipmentContent>();
  public equipmentItem = input.required<EquipmentItem>();
  // Undefined (empty slot) falls back to a single-column tooltip, no comparison.
  public equippedContent = input<EquipmentContent>();
  public equippedItem = input<EquipmentItem>();
  public disabled = input<boolean>(false);

  public equip = output<void>();

  public displayName = computed(() =>
    equipmentItemDisplayName(this.equipmentItem(), this.equipment().name),
  );

  public display = computed<ItemPreviewDisplay>(() => ({
    ...itemPreviewDisplay('equipment', this.equipment(), this.equipmentItem()),
    name: this.displayName(),
  }));

  public equippedDisplay = computed<ItemPreviewDisplay | undefined>(() => {
    const content = this.equippedContent();
    if (!content) return undefined;

    const item = this.equippedItem();
    return {
      ...itemPreviewDisplay('equipment', content, item),
      name: item ? equipmentItemDisplayName(item, content.name) : content.name,
    };
  });

  // This item's comparison baseline is the equipped item's totals, and vice versa.
  public thisItemComparisonStats = computed(() => {
    const equipped = this.equippedDisplay();
    return equipped ? itemPreviewTotalStats(equipped) : undefined;
  });

  public thisItemComparisonResistances = computed(() => {
    const equipped = this.equippedDisplay();
    return equipped ? itemPreviewTotalResistances(equipped) : undefined;
  });

  public thisItemComparisonCombatStats = computed(() => {
    const equipped = this.equippedDisplay();
    return equipped ? itemPreviewTotalCombatStats(equipped) : undefined;
  });

  public thisItemComparisonMonsterTypeDamage = computed(() => {
    const equipped = this.equippedDisplay();
    return equipped ? itemPreviewTotalMonsterTypeDamage(equipped) : undefined;
  });

  public equippedComparisonStats = computed(() =>
    this.equippedDisplay() ? itemPreviewTotalStats(this.display()) : undefined,
  );

  public equippedComparisonResistances = computed(() =>
    this.equippedDisplay()
      ? itemPreviewTotalResistances(this.display())
      : undefined,
  );

  public equippedComparisonCombatStats = computed(() =>
    this.equippedDisplay()
      ? itemPreviewTotalCombatStats(this.display())
      : undefined,
  );

  public equippedComparisonMonsterTypeDamage = computed(() =>
    this.equippedDisplay()
      ? itemPreviewTotalMonsterTypeDamage(this.display())
      : undefined,
  );

  public infusionSlotCount = computed(() =>
    equipmentItemSlotCount(this.equipmentItem()),
  );

  public equippedInfusionSlotCount = computed(() => {
    const item = this.equippedItem();
    return item ? equipmentItemSlotCount(item) : 0;
  });

  public bonusStats = computed(() =>
    equipmentItemBonusStats(this.equipmentItem()),
  );
}
