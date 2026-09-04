import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CardStatusCombatantComponent } from '@components/card-status-combatant/card-status-combatant.component';
import { currentCombat } from '@helpers/combat/combat-state';
import type { StatusCardEntry } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Max helper cards per row - extras wrap onto a new row, same convention as status-monster.
const HELPERS_PER_ROW = 4;

@Component({
  selector: 'app-status-helper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusCombatantComponent],
  templateUrl: './status-helper.component.html',
  styleUrl: './status-helper.component.scss',
})
export class StatusHelperComponent {
  public expanded = input<boolean>(false);

  public entries = computed<StatusCardEntry[]>(() =>
    (currentCombat()?.helpers ?? []).map((combatant) => {
      const maxHp = Math.max(combatant.totalStats.Health, 1);

      return {
        combatantId: combatant.id,
        name: combatant.name,
        spritesheet: 'monster',
        spriteAssetName: combatant.sprite ?? '',
        spriteFrames: combatant.frames,
        isDead: combatant.hp <= 0,
        bars: [
          {
            variant: 'hp',
            percent: clamp((combatant.hp / maxHp) * 100, 0, 100),
            current: combatant.hp,
            max: maxHp,
          },
        ],
      };
    }),
  );

  public rows = computed<StatusCardEntry[][]>(() => {
    const entries = this.entries();
    const rows: StatusCardEntry[][] = [];
    for (let i = 0; i < entries.length; i += HELPERS_PER_ROW) {
      rows.push(entries.slice(i, i + HELPERS_PER_ROW));
    }
    return rows;
  });
}
