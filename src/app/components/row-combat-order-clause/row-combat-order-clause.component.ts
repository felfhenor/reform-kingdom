import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { combatOrderClauseSummary } from '@helpers/combat-order';
import type { CombatOrderClause, EquipmentSkillContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-combat-order-clause',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2 flex-1 min-w-0' },
  imports: [AtlasImageComponent, TippyDirective],
  templateUrl: './row-combat-order-clause.component.html',
})
export class RowCombatOrderClauseComponent {
  public clause = input.required<CombatOrderClause>();

  // Used for the mandatory trailing "always random skill" row, which reads
  // like any other row but isn't a real stored clause - no toggle/edit/remove.
  public readOnly = input<boolean>(false);

  // Only meaningful for CastSkillFamily clauses - see the modal's warning
  // helpers in combat-order-evaluation.ts.
  public isFamilyKnown = input<boolean>(true);
  public isFamilyUsable = input<boolean>(true);
  public isFamilyEquipmentOnly = input<boolean>(false);

  // The hero's currently-resolved skills, used to look up a representative
  // sprite for the clause's family (see `familyOptions` in the modal, which
  // resolves sprites the same way).
  public heroSkills = input<EquipmentSkillContent[]>([]);

  public toggleEnabled = output<void>();
  public remove = output<void>();
  public edit = output<void>();

  public summary = computed(() => combatOrderClauseSummary(this.clause()));

  // Only CastSkillFamily clauses have a skill icon to show - RandomSkill has
  // nothing specific to display.
  public icon = computed<{ name: string; sprite: string } | undefined>(() => {
    const action = this.clause().action;
    if (action.type !== 'CastSkillFamily') return undefined;

    const skill = this.heroSkills().find(
      (skill) => skill.family === action.family,
    );
    return skill ? { name: skill.family, sprite: skill.sprite } : undefined;
  });
}
