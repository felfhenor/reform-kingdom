import { ONE_YEAR_TICKS, RESTING_REGEN_PERCENT } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/hero/global-effects';
import { isGathering } from '@helpers/item/gathering';
import {
  updateGamestate,
  worldTravelState,
  worldCombatState,
} from '@helpers/state-game';
import type {
  Character,
  GlobalEffectContent,
  GlobalEffectId,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// True when the party has nothing else going on - not traveling, gathering, fighting, or recovering.
export function isPartyResting(): boolean {
  return (
    worldTravelState().status === 'Idle' &&
    !isGathering() &&
    !worldCombatState() &&
    !isGlobalEffectActive('Deaths Door' as GlobalEffectId) &&
    !isGlobalEffectActive('Healing' as GlobalEffectId)
  );
}

// Only toggles on a state change - addGlobalEffect doesn't dedupe, so calling it every tick would duplicate entries.
function syncIdleGlobalEffect(resting: boolean): void {
  const isIdleActive = isGlobalEffectActive('Idle' as GlobalEffectId);
  if (resting === isIdleActive) return;

  if (resting) {
    addGlobalEffect('Idle' as GlobalEffectId, ONE_YEAR_TICKS);
    return;
  }

  const idleContent = getEntry<GlobalEffectContent>('Idle' as GlobalEffectId);
  if (idleContent) removeGlobalEffect(idleContent.id);
}

function restedStat(current: number, max: number, boost = 0): number {
  if (current >= max) return current;
  return clamp(
    current +
      Math.floor(boost) +
      Math.max(1, Math.round(max * RESTING_REGEN_PERCENT)),
    0,
    max,
  );
}

// Returns the same character when nothing regenerates, so a fully rested party doesn't churn the party slice every tick.
function restedCharacter(character: Character): Character {
  const hp = restedStat(
    character.hp,
    character.stats.Health,
    character.stats.Constitution,
  );
  const ep = restedStat(
    character.ep,
    character.stats.Energy,
    character.stats.Spirit,
  );
  if (hp === character.hp && ep === character.ep) return character;

  return { ...character, hp, ep };
}

// Runs once per tick - syncs the Idle effect and regens HP/EP while resting.
export function restingProcessTick(): void {
  const resting = isPartyResting();
  syncIdleGlobalEffect(resting);
  if (!resting) return;

  updateGamestate((state) => {
    const party = state.world.party.map(restedCharacter);
    const changed = party.some(
      (character, index) => character !== state.world.party[index],
    );
    if (changed) state.world.party = party;

    return state;
  });
}
