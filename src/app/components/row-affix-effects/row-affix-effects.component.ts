import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RowGatherYieldBonusesComponent } from '@components/row-gather-yield-bonuses/row-gather-yield-bonuses.component';
import { RowSkillStatBonusesComponent } from '@components/row-skill-stat-bonuses/row-skill-stat-bonuses.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import type { AffixDisplay } from '@interfaces';

@Component({
  selector: 'app-row-affix-effects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RowStatSummaryComponent,
    RowGatherYieldBonusesComponent,
    RowSkillStatBonusesComponent,
  ],
  template: `
    @let entry = affix();

    <div class="flex flex-col gap-2 p-2 border border-base-content/20">
      <div class="flex items-center gap-2">
        <span class="type-entity-name text-{{ entry.rarity }}">
          {{ entry.name }}
        </span>
        <span class="type-meta">{{ entry.position }}</span>
      </div>

      @if (entry.hasStatRow) {
        <app-row-stat-summary
          [stats]="entry.stats"
          [resistances]="entry.resistances"
          [combatStats]="entry.combatStats"
          [monsterTypeDamage]="entry.monsterTypeDamage"
          [elementalResistances]="entry.elementalResistances"
          [elementalBoons]="entry.elementalBoons"
          [layout]="'row'"
          [maxDecimals]="1"
        />
      }

      @if (entry.gatherYieldBonuses.length > 0) {
        <app-row-gather-yield-bonuses [bonuses]="entry.gatherYieldBonuses" />
      }

      @if (entry.skillStatBonuses.length > 0) {
        <app-row-skill-stat-bonuses [bonuses]="entry.skillStatBonuses" />
      }

      @if (entry.description) {
        <span class="text-xs">{{ entry.description }}</span>
      }
    </div>
  `,
})
export class RowAffixEffectsComponent {
  public affix = input.required<AffixDisplay>();
}
