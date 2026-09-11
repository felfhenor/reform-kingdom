import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { SFXDirective } from '@directives/sfx.directive';
import { defaultStats } from '@helpers/defaults';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import { equipmentItemBonusStats } from '@helpers/item/equipment-display';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  itemPreviewTotalCombatStats,
  itemPreviewTotalResistances,
  itemPreviewTotalStats,
} from '@helpers/item/item-preview.ui';
import {
  StatShorthand,
  type BaseStat,
  type EquipmentContent,
  type EquipmentItem,
  type ItemPreviewDisplay,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-card-equipment-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotRarityOutlineComponent,
    IconStatComponent,
    RowInfusedMaterialsComponent,
    DetailItemPreviewComponent,
    StatDisplayPipe,
    TippyDirective,
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

  public statShorthand = StatShorthand;

  private statKeys = Object.keys(defaultStats()) as BaseStat[];

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

  public rowStatKeys = computed<BaseStat[]>(() =>
    this.statKeys.filter((stat) => this.totalStatValue(stat) !== 0),
  );

  public totalStatValue(stat: BaseStat): number {
    return this.equipment().baseStats[stat] + this.bonusStats()[stat];
  }

  // Blocked by click rather than the native `disabled` attribute, so the stat-comparison
  // tooltip stays available for inspection (e.g. planning swaps) while equipping is locked.
  public onEquipClick(): void {
    if (this.disabled()) return;
    this.equip.emit();
  }
}
