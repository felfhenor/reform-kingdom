import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { defaultStats, equipmentItemInfusionBonus } from '@helpers';
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
    IconStatComponent,
    RowInfusedMaterialsComponent,
    RowItemStatsComponent,
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

  public equip = output<void>();

  public statShorthand = StatShorthand;

  private statKeys = Object.keys(defaultStats()) as BaseStat[];

  public infusionBonus = computed(() =>
    equipmentItemInfusionBonus(this.equipmentItem().infusedItemIds),
  );

  // Stats shown on the row itself - only what this item actually boosts,
  // baseStats plus any infusion bonus combined into one total.
  public rowStatKeys = computed<BaseStat[]>(() =>
    this.statKeys.filter((stat) => this.totalStatValue(stat) !== 0),
  );

  public totalStatValue(stat: BaseStat): number {
    return this.equipment().baseStats[stat] + this.infusionBonus()[stat];
  }
}
