import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { InfusedMaterialsRowComponent } from '@components/infused-materials-row/infused-materials-row.component';
import { ItemStatRowsComponent } from '@components/item-stat-rows/item-stat-rows.component';
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
  selector: 'app-equipment-item-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconStatComponent,
    InfusedMaterialsRowComponent,
    ItemStatRowsComponent,
    StatDisplayPipe,
    TippyDirective,
  ],
  templateUrl: './equipment-item-card.component.html',
  styleUrl: './equipment-item-card.component.scss',
})
export class EquipmentItemCardComponent {
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
