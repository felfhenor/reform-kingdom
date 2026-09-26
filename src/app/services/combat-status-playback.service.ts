import { Injectable, computed, effect, signal, untracked } from '@angular/core';
import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';
import { combatantDamageEventsClear } from '@helpers/combat/combat-damage-events.ui';
import { combatantSkillCastEvents } from '@helpers/combat/combat-skill-events';
import { combatantSkillCastEventsClear } from '@helpers/combat/combat-skill-events.ui';
import type {
  CombatantDamageEvent,
  CombatantSkillCastEvent,
} from '@interfaces';

type DisplayedDamageNumber = {
  event: CombatantDamageEvent;
  // Uniform -1..1 jitter seed; consumers scale it to their own card width.
  xOffsetSeed: number;
};

// Must match the skill-cast-fade CSS duration so the flash doesn't pop out mid-fade.
const SKILL_CAST_LIFETIME_MS = 1500;
const DAMAGE_NUMBER_LIFETIME_MS = 1100;
// A backgrounded tab can dump a huge backlog of hits at once - only the newest are worth animating.
const DAMAGE_NUMBER_MAX_PER_BATCH = 24;

// Drains the shared damage/skill-cast event buses (hero + monster ids
// mixed) into per-combatant display state, shared by both status bars.
@Injectable({
  providedIn: 'root',
})
export class CombatStatusPlaybackService {
  public readonly damageNumberLifetimeMs = DAMAGE_NUMBER_LIFETIME_MS;

  private displayedDamageNumbers = signal<DisplayedDamageNumber[]>([]);
  private displayedSkillCasts = signal<CombatantSkillCastEvent[]>([]);

  public damageNumbersByCombatant = computed(() => {
    const grouped = new Map<string, DisplayedDamageNumber[]>();
    this.displayedDamageNumbers().forEach((entry) => {
      const existing = grouped.get(entry.event.combatantId) ?? [];
      grouped.set(entry.event.combatantId, [...existing, entry]);
    });
    return grouped;
  });

  public skillCastByCombatant = computed(() => {
    const grouped = new Map<string, CombatantSkillCastEvent>();
    this.displayedSkillCasts().forEach((event) => {
      grouped.set(event.combatantId, event);
    });
    return grouped;
  });

  constructor() {
    // Drains the shared queue in the same pass it displays it; `untracked` avoids self-retrigger off its own write.
    effect(() => {
      const events = combatantDamageEvents();
      if (events.length === 0) return;

      untracked(() => this.showDamageEvents(events));
    });

    effect(() => {
      const events = combatantSkillCastEvents();
      if (events.length === 0) return;

      untracked(() => this.showSkillCastEvents(events));
    });
  }

  private showDamageEvents(events: CombatantDamageEvent[]): void {
    combatantDamageEventsClear(events.map((event) => event.id));

    const shownEvents = events.slice(-DAMAGE_NUMBER_MAX_PER_BATCH);
    const displayEntries: DisplayedDamageNumber[] = shownEvents.map(
      (event) => ({
        event,
        xOffsetSeed: Math.random() * 2 - 1,
      }),
    );

    this.displayedDamageNumbers.update((current) => [
      ...current,
      ...displayEntries,
    ]);

    setTimeout(() => {
      const ids = new Set(shownEvents.map((event) => event.id));
      this.displayedDamageNumbers.update((current) =>
        current.filter((entry) => !ids.has(entry.event.id)),
      );
    }, DAMAGE_NUMBER_LIFETIME_MS);
  }

  private showSkillCastEvents(events: CombatantSkillCastEvent[]): void {
    combatantSkillCastEventsClear(events.map((event) => event.id));

    this.displayedSkillCasts.update((current) => [...current, ...events]);

    setTimeout(() => {
      const ids = new Set(events.map((event) => event.id));
      this.displayedSkillCasts.update((current) =>
        current.filter((entry) => !ids.has(entry.id)),
      );
    }, SKILL_CAST_LIFETIME_MS);
  }
}
