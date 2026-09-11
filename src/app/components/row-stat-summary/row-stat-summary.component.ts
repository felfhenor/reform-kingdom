import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { RowLabeledValuesComponent } from '@components/row-labeled-values/row-labeled-values.component';
import {
  type CombatStat,
  type CombatStatBlock,
  CombatStatDimension,
  type StatBlock,
  type StatusEffectBlock,
  type StatusEffectTag,
  StatusEffectTagDimension,
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

  public resistances = input<StatusEffectBlock>();
  public bonusResistances = input<StatusEffectBlock>();

  public combatStats = input<CombatStatBlock>();
  public bonusCombatStats = input<CombatStatBlock>();

  // 'column' (default) for tooltips/detail panels; 'row' for compact,
  // space-constrained lists (e.g. a picker row) - mirrors the underlying rows.
  public layout = input<'column' | 'row'>('column');
  public maxDecimals = input(2);
  public showSign = input(true);

  // Bonus-only values (e.g. a combat-stat/resistance affix on an item with
  // no base value in that dimension) must still trigger the row - checking
  // only the base block hides them entirely.
  public hasAnyResistances = computed(() => {
    const resistances = this.resistances() ?? ({} as StatusEffectBlock);
    const bonus = this.bonusResistances() ?? ({} as StatusEffectBlock);
    return [...Object.keys(resistances), ...Object.keys(bonus)].some(
      (k) =>
        (resistances[k as StatusEffectTag] ?? 0) !== 0 ||
        (bonus[k as StatusEffectTag] ?? 0) !== 0,
    );
  });

  public hasAnyCombatStats = computed(() => {
    const combatStats =
      this.combatStats() ?? ({} as Record<CombatStat, number>);
    const bonus = this.bonusCombatStats() ?? ({} as Record<CombatStat, number>);
    return [...Object.keys(combatStats), ...Object.keys(bonus)].some(
      (k) =>
        (combatStats[k as CombatStat] ?? 0) !== 0 ||
        (bonus[k as CombatStat] ?? 0) !== 0,
    );
  });

  public resistanceDimension = StatusEffectTagDimension;
  public combatStatDimension = CombatStatDimension;
}
