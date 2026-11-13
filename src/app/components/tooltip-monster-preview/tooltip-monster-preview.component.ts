import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { DetailMonsterSummaryComponent } from '@components/detail-monster-summary/detail-monster-summary.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { combatantFromMonster } from '@helpers/combat/combat-create';
import {
  bestiaryCombatantSkills,
  bestiaryEntry,
  bestiaryMonsterSkills,
} from '@helpers/kingdom/bestiary.ui';
import type { Combatant, MonsterContent } from '@interfaces';

@Component({
  selector: 'app-tooltip-monster-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    DetailMonsterSummaryComponent,
    RowStatSummaryComponent,
  ],
  host: { class: 'hidden' },
  template: `
    <ng-template #tooltipContent>
      @let e = entry();
      <div class="flex flex-col gap-2 p-2 max-w-[400px]">
        <app-detail-monster-summary [entry]="e" [level]="level()" />

        @if (foe() && !e.analyzed) {
          <span class="type-meta text-lighter">
            Analyze this foe to learn its strengths and weaknesses.
          </span>
        } @else if (foe()) {
          @let c = shownCombatant();
          <app-row-stat-summary
            [combatStats]="c.combatStats"
            [resistances]="c.tagResistance"
            [elementalResistances]="c.resistance"
            [showSign]="false"
          />

          <span class="type-label">Attacks</span>
          <div class="grid grid-cols-2 gap-2">
            @for (skill of skills(); track skill.id) {
              <span class="flex items-center gap-2 min-w-0">
                <app-atlas-image
                  class="zoom-inline shrink-0"
                  spritesheet="skill"
                  [assetName]="skill.sprite"
                />
                <span class="text-xs truncate text-{{ skill.rarity }}">
                  {{ skill.name }}
                </span>
              </span>
            } @empty {
              <span class="type-meta">None.</span>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class TooltipMonsterPreviewComponent {
  public monster = input.required<MonsterContent>();
  public level = input<number>();
  public combatant = input<Combatant>();
  public isEnemy = input<boolean>(true);

  // Allies (raid defenders, helpers) can't be analyzed, so they only get the summary.
  public foe = computed(() => this.combatant()?.isEnemy ?? this.isEnemy());

  // Only used where the monster is already on screen (combat, raids), so it never shows as "???".
  public entry = computed(() => ({
    ...bestiaryEntry(this.monster()),
    discovered: true,
  }));

  private shownLevel = computed(() => this.level() ?? 1);

  public shownCombatant = computed(
    () =>
      this.combatant() ??
      combatantFromMonster(this.monster(), this.shownLevel(), 0, this.foe()),
  );

  public skills = computed(() => {
    const live = this.combatant();
    return live
      ? bestiaryCombatantSkills(live)
      : bestiaryMonsterSkills(this.monster(), this.shownLevel());
  });

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}
