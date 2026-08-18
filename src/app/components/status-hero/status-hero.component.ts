import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { getEntry } from '@helpers/content';
import {
  heroDamageEvents,
  heroDamageEventsClear,
} from '@helpers/combat-damage-events';
import { partyGet } from '@helpers/party';
import { getOption } from '@helpers/state-options';
import type { Character, HeroDamageEvent, JobContent } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

type HeroStatusEntry = {
  character: Character;
  job: JobContent | undefined;
  hpPercent: number;
  xpPercent: number;
  isDead: boolean;
};

// How long a floating damage/heal number stays on screen before being
// removed - must match the CSS animation duration in the stylesheet so the
// number doesn't pop out mid-fade.
const DAMAGE_NUMBER_LIFETIME_MS = 1100;

@Component({
  selector: 'app-status-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconJobComponent],
  templateUrl: './status-hero.component.html',
  styleUrl: './status-hero.component.scss',
})
export class StatusHeroComponent {
  // Only used when `partyViewAutoCollapse` is on - otherwise the party view
  // stays expanded regardless of hover state.
  private isHovered = signal(false);

  public isExpanded = computed(
    () => !getOption('partyViewAutoCollapse') || this.isHovered(),
  );

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }

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

  // Floating damage/heal numbers currently on screen, keyed by the hero they
  // belong to - always rendered regardless of `isExpanded`, since the point
  // is to show something is happening even when the bar is collapsed.
  private displayedDamageNumbers = signal<HeroDamageEvent[]>([]);

  public damageNumbersByHero = computed(() => {
    const grouped = new Map<string, HeroDamageEvent[]>();
    this.displayedDamageNumbers().forEach((entry) => {
      const existing = grouped.get(entry.characterId) ?? [];
      grouped.set(entry.characterId, [...existing, entry]);
    });
    return grouped;
  });

  constructor() {
    // `heroDamageEvents` is a shared queue rather than per-component state,
    // so this both displays and drains it in the same pass - reading
    // `displayedDamageNumbers` inside `untracked` avoids this effect
    // re-triggering itself off its own write.
    effect(() => {
      const events = heroDamageEvents();
      if (events.length === 0) return;

      untracked(() => this.showDamageEvents(events));
    });
  }

  private showDamageEvents(events: HeroDamageEvent[]): void {
    this.displayedDamageNumbers.update((current) => [...current, ...events]);
    heroDamageEventsClear(events.map((event) => event.id));

    setTimeout(() => {
      const ids = new Set(events.map((event) => event.id));
      this.displayedDamageNumbers.update((current) =>
        current.filter((event) => !ids.has(event.id)),
      );
    }, DAMAGE_NUMBER_LIFETIME_MS);
  }
}
