import { combatResolveAutoWin } from '@helpers/combat/combat-end';
import { categoryMessageLog } from '@helpers/combat/combat-log';
import { INTIMIDATION_COOLDOWN_TICKS } from '@helpers/config';
import { encounterCreateFightCombat } from '@helpers/encounter/encounter';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { jobAbilityHighest } from '@helpers/hero/job-ability';
import {
  gamestate,
  updateGamestate,
  worldCurrentLocationState,
} from '@helpers/state-game';
import type { Character, EncounterContent } from '@interfaces';

// Resolves every fight at once with full rewards; the party never takes a hit.
export function encounterAutoWin(
  encounter: EncounterContent,
  nodeName: string,
  intimidator: Character,
): void {
  categoryMessageLog(
    'Travel',
    worldCurrentLocationState().mapName,
    `**${intimidator.name}** intimidated the enemies at ${nodeName} into surrendering!`,
  );

  encounter.fights.forEach((_, fightIndex) => {
    const combat = encounterCreateFightCombat(
      encounter.id,
      fightIndex,
      nodeName,
    );
    if (!combat) return;

    // Reward helpers treat guardians at 0 HP as defeated.
    combat.guardians.forEach((guardian) => (guardian.hp = 0));
    combatResolveAutoWin(combat, fightIndex === encounter.fights.length - 1);
  });
}

// True when the encounter surrendered - never waits on the cooldown, so the caller just starts the fight otherwise.
export function encounterTryIntimidate(
  encounter: EncounterContent,
  nodeName: string,
): boolean {
  const intimidator = jobAbilityHighest('Intimidation');
  if (!intimidator || encounter.levelRange.max > intimidator.amount) {
    return false;
  }

  const now = timerTicksElapsed();
  const lastTick = gamestate().world.intimidationLastTick;
  if (lastTick !== undefined && now - lastTick < INTIMIDATION_COOLDOWN_TICKS) {
    return false;
  }

  updateGamestate((state) => {
    state.world.intimidationLastTick = now;
    return state;
  });

  encounterAutoWin(encounter, nodeName, intimidator.character);
  return true;
}
