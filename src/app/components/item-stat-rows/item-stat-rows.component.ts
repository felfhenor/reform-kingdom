import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  IconStatComponent,
  STAT_SHORTHAND,
} from '@components/icon-stat/icon-stat.component';
import type { BaseStat, StatBlock } from '@interfaces';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-item-stat-rows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconStatComponent, StatDisplayPipe],
  templateUrl: './item-stat-rows.component.html',
  styleUrl: './item-stat-rows.component.scss',
})
export class ItemStatRowsComponent {
  public stats = input.required<StatBlock>();
  // Extra flat bonus (e.g. from infusions) shown as its own set of rows,
  // always in green, below the base rows.
  public bonusStats = input<StatBlock>();
  // When set, base rows show the delta against this baseline instead of
  // the raw value, colored green/rose (equip-picker "compare to equipped").
  public comparisonStats = input<StatBlock>();
  public maxDecimals = input(2);
  // 'column' (default) for tooltips/detail panels; 'row' for compact,
  // space-constrained lists (e.g. a picker row).
  public layout = input<'column' | 'row'>('column');
  // Off for a plain stat readout (e.g. a bestiary entry) where every value
  // is already known-positive and a leading "+" would just be noise.
  public showSign = input(true);

  public statShorthand = STAT_SHORTHAND;
  private statKeys: BaseStat[] = [
    'Health',
    'Energy',
    'Strength',
    'Intelligence',
    'Vitality',
    'Resistance',
    'Agility',
    'Luck',
  ];

  public hasComparison = computed(() => !!this.comparisonStats());

  public baseRows = computed<BaseStat[]>(() =>
    this.statKeys.filter(
      (stat) => this.baseValue(stat) !== 0 || this.deltaValue(stat) !== 0,
    ),
  );

  public bonusRows = computed<BaseStat[]>(() => {
    const bonus = this.bonusStats();
    if (!bonus) return [];
    return this.statKeys.filter((stat) => bonus[stat] !== 0);
  });

  public baseValue(stat: BaseStat): number {
    return this.stats()[stat];
  }

  public deltaValue(stat: BaseStat): number {
    const comparison = this.comparisonStats();
    return comparison ? this.baseValue(stat) - comparison[stat] : 0;
  }

  public bonusValue(stat: BaseStat): number {
    return this.bonusStats()?.[stat] ?? 0;
  }

  public rowValue(stat: BaseStat): number {
    return this.hasComparison() ? this.deltaValue(stat) : this.baseValue(stat);
  }
}
