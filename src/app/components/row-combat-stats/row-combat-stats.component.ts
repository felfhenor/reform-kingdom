import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CombatStatIsPercent,
  CombatStatLabel,
  CombatStatOrder,
  type CombatantCombatStats,
  type CombatStat,
} from '@interfaces';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-row-combat-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatDisplayPipe],
  templateUrl: './row-combat-stats.component.html',
  styleUrl: './row-combat-stats.component.scss',
})
export class RowCombatStatsComponent {
  // Optional - equipment content built outside `ensureEquipment` (e.g. test
  // fixtures) may not have this densely filled.
  public stats = input<CombatantCombatStats>();
  // Extra bonus (e.g. from infusions/affixes) shown as its own set of rows,
  // always in green, below the base rows - mirrors `RowItemStatsComponent.bonusStats`.
  public bonusStats = input<CombatantCombatStats>();
  // 'column' (default) for tooltips/detail panels, full sentence per row;
  // 'row' for compact space-constrained lists - mirrors `RowItemStatsComponent.layout`.
  public layout = input<'column' | 'row'>('column');

  public statLabel = CombatStatLabel;
  public isPercent = CombatStatIsPercent;

  private sortedNonzero(
    stats: CombatantCombatStats | undefined,
  ): CombatStat[] {
    if (!stats) return [];
    return CombatStatOrder.filter((stat) => stats[stat] !== 0);
  }

  public baseRows = computed<CombatStat[]>(() =>
    this.sortedNonzero(this.stats()),
  );

  public bonusRows = computed<CombatStat[]>(() =>
    this.sortedNonzero(this.bonusStats()),
  );

  public baseValue(stat: CombatStat): number {
    return this.stats()?.[stat] ?? 0;
  }

  public bonusValue(stat: CombatStat): number {
    return this.bonusStats()?.[stat] ?? 0;
  }
}
