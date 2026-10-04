import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { RowLabeledValuesComponent } from '@components/row-labeled-values/row-labeled-values.component';
import {
  type CombatStatBlock,
  CombatStatDimension,
  type ElementBlock,
  ElementBoonDimension,
  ElementResistanceDimension,
  type MonsterType,
  MonsterTypeDimension,
  type StatBlock,
  type StatusEffectBlock,
  StatusEffectTagDimension,
} from '@interfaces';

function hasAnyNonzero(
  base: Partial<Record<string, number>> | undefined,
  bonus: Partial<Record<string, number>> | undefined,
): boolean {
  return [...Object.values(base ?? {}), ...Object.values(bonus ?? {})].some(
    (value) => (value ?? 0) !== 0,
  );
}

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
  public comparisonResistances = input<StatusEffectBlock>();

  public combatStats = input<CombatStatBlock>();
  public bonusCombatStats = input<CombatStatBlock>();
  public comparisonCombatStats = input<CombatStatBlock>();

  public monsterTypeDamage = input<Record<MonsterType, number>>();
  public bonusMonsterTypeDamage = input<Record<MonsterType, number>>();
  public comparisonMonsterTypeDamage = input<Record<MonsterType, number>>();

  public elementalResistances = input<ElementBlock>();
  public bonusElementalResistances = input<ElementBlock>();
  public comparisonElementalResistances = input<ElementBlock>();

  public elementalBoons = input<ElementBlock>();
  public bonusElementalBoons = input<ElementBlock>();
  public comparisonElementalBoons = input<ElementBlock>();

  // 'column' (default) for tooltips/detail panels; 'row' for compact,
  // space-constrained lists (e.g. a picker row) - mirrors the underlying rows.
  public layout = input<'column' | 'row'>('column');
  public maxDecimals = input(2);
  public showSign = input(true);

  // Bonus-only values (e.g. a combat-stat/resistance affix on an item with
  // no base value in that dimension) must still trigger the row - checking
  // only the base block hides them entirely.
  public hasAnyResistances = computed(() =>
    hasAnyNonzero(this.resistances(), this.bonusResistances()),
  );

  public hasAnyCombatStats = computed(() =>
    hasAnyNonzero(this.combatStats(), this.bonusCombatStats()),
  );

  public hasAnyMonsterTypeDamage = computed(() =>
    hasAnyNonzero(this.monsterTypeDamage(), this.bonusMonsterTypeDamage()),
  );

  public hasAnyElementalResistances = computed(() =>
    hasAnyNonzero(
      this.elementalResistances(),
      this.bonusElementalResistances(),
    ),
  );

  public hasAnyElementalBoons = computed(() =>
    hasAnyNonzero(this.elementalBoons(), this.bonusElementalBoons()),
  );

  public resistanceDimension = StatusEffectTagDimension;
  public combatStatDimension = CombatStatDimension;
  public monsterTypeDamageDimension = MonsterTypeDimension;
  public elementalResistanceDimension = ElementResistanceDimension;
  public elementalBoonDimension = ElementBoonDimension;
}
