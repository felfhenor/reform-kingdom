import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatusEffectTagLabel, type StatusEffectTag } from '@interfaces';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';
import { sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-row-debuff-resistances',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatDisplayPipe],
  templateUrl: './row-debuff-resistances.component.html',
  styleUrl: './row-debuff-resistances.component.scss',
})
export class RowDebuffResistancesComponent {
  // Optional - equipment content built outside `ensureEquipment` (e.g. test
  // fixtures) may not have this densely filled.
  public resistances = input<Record<StatusEffectTag, number>>();
  // Extra bonus (e.g. from infusions) shown as its own set of rows, always
  // in green, below the base rows - mirrors `RowItemStatsComponent.bonusStats`.
  public bonusResistances = input<Record<StatusEffectTag, number>>();
  // 'column' (default) for tooltips/detail panels, full sentence per row;
  // 'row' for compact space-constrained lists - mirrors `RowItemStatsComponent.layout`.
  public layout = input<'column' | 'row'>('column');

  public tagLabel = StatusEffectTagLabel;

  private sortedNonzeroTags(
    resistances: Record<StatusEffectTag, number> | undefined,
  ): StatusEffectTag[] {
    if (!resistances) return [];
    const tags = (Object.keys(resistances) as StatusEffectTag[]).filter(
      (tag) => resistances[tag] !== 0,
    );
    return sortBy(tags, [(tag) => StatusEffectTagLabel[tag]]);
  }

  public baseRows = computed<StatusEffectTag[]>(() =>
    this.sortedNonzeroTags(this.resistances()),
  );

  public bonusRows = computed<StatusEffectTag[]>(() =>
    this.sortedNonzeroTags(this.bonusResistances()),
  );

  public baseValue(tag: StatusEffectTag): number {
    return this.resistances()?.[tag] ?? 0;
  }

  public bonusValue(tag: StatusEffectTag): number {
    return this.bonusResistances()?.[tag] ?? 0;
  }
}
