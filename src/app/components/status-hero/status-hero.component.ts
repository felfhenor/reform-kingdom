import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CardStatusCombatantComponent } from '@components/card-status-combatant/card-status-combatant.component';
import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/party';
import type { Combatant, JobContent, StatusCardEntry } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

@Component({
  selector: 'app-status-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusCombatantComponent],
  templateUrl: './status-hero.component.html',
  styleUrl: './status-hero.component.scss',
})
export class StatusHeroComponent {
  public expanded = input<boolean>(false);

  public entries = computed<StatusCardEntry[]>(() => {
    // HP lives on the live `Combatant` during a fight - `Character.hp` only
    // resyncs once combat ends, so it'd show stale HP for the whole fight.
    const liveCombatantsById = new Map<string, Combatant>(
      (currentCombat()?.heroes ?? []).map((combatant) => [
        combatant.id,
        combatant,
      ]),
    );

    return partyGet().map((character) => {
      const live = liveCombatantsById.get(character.id);
      const hp = live?.hp ?? character.hp;
      const maxHp = Math.max(
        live?.totalStats.Health ?? character.stats.Health,
        1,
      );
      const maxXp = Math.max(character.xp.maximum, 1);
      const job = getEntry<JobContent>(character.jobId);

      return {
        combatantId: character.id,
        name: character.name,
        subtitleLevel: character.level,
        subtitleLabel: job?.name ?? '',
        spritesheet: 'job',
        spriteAssetName: job?.sprite ?? '',
        spriteFrames: job?.frames ?? 4,
        isDead: hp <= 0,
        bars: [
          {
            variant: 'hp',
            percent: clamp((hp / maxHp) * 100, 0, 100),
            current: hp,
            max: maxHp,
          },
          {
            variant: 'xp',
            percent: clamp((character.xp.current / maxXp) * 100, 0, 100),
            current: character.xp.current,
            max: maxXp,
          },
        ],
      };
    });
  });
}
