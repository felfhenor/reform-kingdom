import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { defaultStats } from '@helpers/defaults';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
} from '@helpers/item/equipment-display';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import {
  StatShorthand,
  type BaseStat,
  type EquipmentContent,
  type EquipmentItem,
  type StatBlock,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-card-equipment-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    SlotRarityOutlineComponent,
    IconStatComponent,
    RowInfusedMaterialsComponent,
    RowStatSummaryComponent,
    StatDisplayPipe,
    TippyDirective,
  ],
  templateUrl: './card-equipment-item.component.html',
  styleUrl: './card-equipment-item.component.scss',
})
export class CardEquipmentItemComponent {
  public equipment = input.required<EquipmentContent>();
  public equipmentItem = input.required<EquipmentItem>();
  public comparisonStats = input<StatBlock>();
  public disabled = input<boolean>(false);

  public equip = output<void>();

  public statShorthand = StatShorthand;

  private statKeys = Object.keys(defaultStats()) as BaseStat[];

  public displayName = computed(() =>
    equipmentItemDisplayName(this.equipmentItem(), this.equipment().name),
  );

  public bonusStats = computed(() =>
    equipmentItemBonusStats(this.equipmentItem()),
  );

  public bonusResistances = computed(() =>
    equipmentItemBonusResistances(this.equipmentItem()),
  );

  public bonusCombatStats = computed(() =>
    equipmentItemBonusCombatStats(this.equipmentItem()),
  );

  public infusionSlotCount = computed(() =>
    equipmentItemSlotCount(this.equipmentItem()),
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
