import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import {
  StatOrder,
  StatShorthand,
  type BaseStat,
  type StatBlock,
} from '@interfaces';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-row-item-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconStatComponent, StatDisplayPipe],
  templateUrl: './row-item-stats.component.html',
  styleUrl: './row-item-stats.component.scss',
})
export class RowItemStatsComponent {
  public stats = input.required<StatBlock>();
  // Extra flat bonus (e.g. from infusions/affixes), merged into the base
  // value it modifies rather than shown as its own row.
  public bonusStats = input<StatBlock>();
  // When set, rows show the delta against this baseline (base+bonus total)
  // instead of the raw value, colored green/rose (equip-picker "compare to equipped").
  public comparisonStats = input<StatBlock>();
  public maxDecimals = input(2);
  // 'column' (default) for tooltips/detail panels; 'row' for compact,
  // space-constrained lists (e.g. a picker row).
  public layout = input<'column' | 'row'>('column');
  // Off for a plain stat readout (e.g. a bestiary entry) where every value
  // is already known-positive and a leading "+" would just be noise.
  public showSign = input(true);

  public statShorthand = StatShorthand;
  private statKeys = StatOrder;

  public hasComparison = computed(() => !!this.comparisonStats());

  public baseRows = computed<BaseStat[]>(() =>
    this.statKeys.filter(
      (stat) =>
        this.baseValue(stat) !== 0 ||
        this.bonusValue(stat) !== 0 ||
        this.deltaValue(stat) !== 0,
    ),
  );

  public baseValue(stat: BaseStat): number {
    return this.stats()[stat];
  }

  public bonusValue(stat: BaseStat): number {
    return this.bonusStats()?.[stat] ?? 0;
  }

  public totalValue(stat: BaseStat): number {
    return this.baseValue(stat) + this.bonusValue(stat);
  }

  public deltaValue(stat: BaseStat): number {
    const comparison = this.comparisonStats();
    return comparison ? this.totalValue(stat) - comparison[stat] : 0;
  }

  public rowValue(stat: BaseStat): number {
    return this.hasComparison() ? this.deltaValue(stat) : this.totalValue(stat);
  }

  public isPositive(stat: BaseStat): boolean {
    return this.hasComparison()
      ? this.deltaValue(stat) > 0
      : this.bonusValue(stat) > 0;
  }

  public isNegative(stat: BaseStat): boolean {
    return this.hasComparison()
      ? this.deltaValue(stat) < 0
      : this.bonusValue(stat) < 0;
  }
}
