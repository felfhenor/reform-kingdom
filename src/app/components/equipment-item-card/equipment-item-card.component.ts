import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import {
  IconStatComponent,
  STAT_SHORTHAND,
} from '@components/icon-stat/icon-stat.component';
import { defaultStats } from '@helpers';
import type { BaseStat, EquipmentContent, StatBlock } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-equipment-item-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconStatComponent,
    StatDisplayPipe,
    TippyDirective,
  ],
  templateUrl: './equipment-item-card.component.html',
  styleUrl: './equipment-item-card.component.scss',
})
export class EquipmentItemCardComponent {
  public equipment = input.required<EquipmentContent>();
  public comparisonStats = input<StatBlock>();

  public equip = output<void>();

  public statShorthand = STAT_SHORTHAND;

  private statKeys = Object.keys(defaultStats()) as BaseStat[];

  // Stats shown on the row itself - only what this item actually boosts.
  public rowStatKeys = computed<BaseStat[]>(() =>
    this.statKeys.filter((stat) => this.statValue(stat) !== 0),
  );

  // Stats shown in the compare tooltip - also includes stats this item
  // doesn't touch but the currently-equipped item does, so a swap that
  // *loses* a stat still shows up as a negative delta.
  public tooltipStatKeys = computed<BaseStat[]>(() =>
    this.statKeys.filter(
      (stat) => this.statValue(stat) !== 0 || this.statDelta(stat) !== 0,
    ),
  );

  public statValue(stat: BaseStat): number {
    return this.equipment().baseStats[stat];
  }

  public statDelta(stat: BaseStat): number {
    return this.statValue(stat) - (this.comparisonStats()?.[stat] ?? 0);
  }
}
