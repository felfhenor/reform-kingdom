import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/party';
import type { Character, JobContent } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

type HeroStatusEntry = {
  character: Character;
  job: JobContent | undefined;
  hpPercent: number;
  xpPercent: number;
  isDead: boolean;
};

@Component({
  selector: 'app-status-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconJobComponent],
  templateUrl: './status-hero.component.html',
  styleUrl: './status-hero.component.scss',
})
export class StatusHeroComponent {
  public isExpanded = signal(false);

  public heroes = computed<HeroStatusEntry[]>(() =>
    partyGet().map((character) => {
      const maxHp = Math.max(character.stats.Health, 1);
      const maxXp = Math.max(character.xp.maximum, 1);

      return {
        character,
        job: getEntry<JobContent>(character.jobId),
        hpPercent: clamp((character.hp / maxHp) * 100, 0, 100),
        xpPercent: clamp((character.xp.current / maxXp) * 100, 0, 100),
        isDead: character.hp <= 0,
      };
    }),
  );
}
