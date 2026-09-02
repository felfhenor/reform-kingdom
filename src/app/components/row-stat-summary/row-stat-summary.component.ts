import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { RowLabeledValuesComponent } from '@components/row-labeled-values/row-labeled-values.component';
import type { CombatStat, GameStat } from '@interfaces';
import {
  CombatStatDimension,
  StatusEffectTagDimension,
  type CombatantCombatStats,
  type StatBlock,
  type StatusEffectTag,
} from '@interfaces';

@Component({
  selector: 'app-row-stat-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RowItemStatsComponent, RowLabeledValuesComponent],
  templateUrl: './row-stat-summary.component.html',
  styleUrl: './row-stat-summary.component.scss',
})
export class RowStatSummaryComponent {
  public stats = input<StatBlock>();
  public bonusStats = input<StatBlock>();
  public comparisonStats = input<StatBlock>();

  public resistances = input<Record<StatusEffectTag, number>>();
  public bonusResistances = input<Record<StatusEffectTag, number>>();

  public combatStats = input<CombatantCombatStats>();
  public bonusCombatStats = input<CombatantCombatStats>();

  // 'column' (default) for tooltips/detail panels; 'row' for compact,
  // space-constrained lists (e.g. a picker row) - mirrors the underlying rows.
  public layout = input<'column' | 'row'>('column');
  public maxDecimals = input(2);
  public showSign = input(true);

  public hasAnyStats = computed(() => {
    const stats = this.stats() ?? ({} as StatBlock);
    return Object.keys(stats).some((k) => (stats[k as GameStat] ?? 0) > 0);
  });

  public hasAnyResistances = computed(() => {
    const resistances =
      this.resistances() ?? ({} as Record<StatusEffectTag, number>);
    return Object.keys(resistances).some(
      (k) => (resistances[k as StatusEffectTag] ?? 0) > 0,
    );
  });

  public hasAnyCombatStats = computed(() => {
    const combatStats =
      this.combatStats() ?? ({} as Record<CombatStat, number>);
    return Object.keys(combatStats).some(
      (k) => (combatStats[k as CombatStat] ?? 0) > 0,
    );
  });

  public resistanceDimension = StatusEffectTagDimension;
  public combatStatDimension = CombatStatDimension;
}
