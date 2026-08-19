import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CardStatusCombatantComponent } from '@components/card-status-combatant/card-status-combatant.component';
import { currentCombat } from '@helpers/combat';
import type { StatusCardEntry } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Max monster cards per row - extras wrap onto a new row above (see `rows`).
const MONSTERS_PER_ROW = 4;

@Component({
  selector: 'app-status-monster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusCombatantComponent],
  templateUrl: './status-monster.component.html',
  styleUrl: './status-monster.component.scss',
})
export class StatusMonsterComponent {
  public expanded = input<boolean>(false);

  public entries = computed<StatusCardEntry[]>(() =>
    (currentCombat()?.guardians ?? []).map((combatant) => {
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

  // Chunked into rows of `MONSTERS_PER_ROW`; the template stacks rows in
  // `column-reverse` so row 0 sits nearest the hero row, wrapping upward.
  public rows = computed<StatusCardEntry[][]>(() => {
    const entries = this.entries();
    const rows: StatusCardEntry[][] = [];
    for (let i = 0; i < entries.length; i += MONSTERS_PER_ROW) {
      rows.push(entries.slice(i, i + MONSTERS_PER_ROW));
    }
    return rows;
  });
}
