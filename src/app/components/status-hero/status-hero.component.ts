import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  untracked,
} from '@angular/core';
import { CardStatusCombatantComponent } from '@components/card-status-combatant/card-status-combatant.component';
import { combatantDamageEventEmit } from '@helpers/combat/combat-damage-events';
import { getEntry } from '@helpers/content/content';
import { isPageVisible } from '@helpers/engine/page-visibility';
import { characterVitalsGain } from '@helpers/hero/resting.ui';
import { worldCombatState, worldPartyState } from '@helpers/state-game';
import type {
  Character,
  Combatant,
  JobContent,
  StatusCardEntry,
} from '@interfaces';

@Component({
  selector: 'app-status-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusCombatantComponent],
  templateUrl: './status-hero.component.html',
  styleUrl: './status-hero.component.scss',
})
export class StatusHeroComponent {
  private lastVitals = new Map<string, Pick<Character, 'hp' | 'ep'>>();
  private wasInCombat = false;

  public expanded = input<boolean>(false);

  constructor() {
    effect(() => {
      const party = worldPartyState();
      const inCombat = !!worldCombatState();
      untracked(() => this.emitVitalsGains(party, inCombat));
    });
  }

  public entries = computed<StatusCardEntry[]>(() => {
    // HP lives on the live `Combatant` during a fight - `Character.hp` only
    // resyncs once combat ends, so it'd show stale HP for the whole fight.
    const liveCombatantsById = new Map<string, Combatant>(
      (worldCombatState()?.heroes ?? []).map((combatant) => [
        combatant.id,
        combatant,
      ]),
    );

    return worldPartyState().map((character) => {
      const live = liveCombatantsById.get(character.id);
      const hp = live?.hp ?? character.hp;
      const maxHp = Math.max(
        live?.totalStats.Health ?? character.stats.Health,
        1,
      );
      const ep = live?.ep ?? character.ep;
      const maxEp = Math.max(
        live?.totalStats.Energy ?? character.stats.Energy,
        1,
      );
      const maxXp = Math.max(character.xp.maximum, 1);
      const job = getEntry<JobContent>(character.jobId);

      return {
        combatantId: character.id,
        name: character.name,
        subtitleLevel: character.level,
        subtitleLabel: job?.shorthand ?? '',
        spritesheet: 'job',
        spriteAssetName: job?.sprite ?? '',
        spriteFrames: job?.frames ?? 4,
        isDead: hp <= 0,
        bars: [
          {
            variant: 'hp',
            current: hp,
            max: maxHp,
          },
          {
            variant: 'ep',
            current: ep,
            max: maxEp,
          },
          {
            variant: 'xp',
            current: character.xp.current,
            max: maxXp,
          },
        ],
      };
    });
  });

  // Combat HP already has its own events, and the sync at combat end isn't a gain worth showing.
  private emitVitalsGains(party: Character[], inCombat: boolean): void {
    const canEmit = !inCombat && !this.wasInCombat && isPageVisible();

    party.forEach((character) => {
      if (canEmit) {
        const gain = characterVitalsGain(
          this.lastVitals.get(character.id),
          character,
        );
        if (gain.hp > 0) combatantDamageEventEmit(character.id, gain.hp);
        if (gain.ep > 0) {
          combatantDamageEventEmit(character.id, gain.ep, 'energy');
        }
      }

      this.lastVitals.set(character.id, { hp: character.hp, ep: character.ep });
    });

    this.wasInCombat = inCombat;
  }
}
