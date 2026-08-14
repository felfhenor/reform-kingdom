import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { combatOrderClauseSummary } from '@helpers/combat-order';
import type { CombatOrderClause } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-combat-order-clause',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2 flex-1 min-w-0' },
  imports: [TippyDirective],
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

  public toggleEnabled = output<void>();
  public remove = output<void>();
  public edit = output<void>();

  public summary = computed(() => combatOrderClauseSummary(this.clause()));
}
