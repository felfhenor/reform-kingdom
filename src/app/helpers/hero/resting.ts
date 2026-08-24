import { currentCombat } from '@helpers/combat/combat';
import { getEntry } from '@helpers/content';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/hero/global-effects';
import { isGathering } from '@helpers/item/gathering';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { GlobalEffectContent, GlobalEffectId } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

const RESTING_REGEN_PERCENT = 0.01;

// Long enough that the Idle global effect never expires on its own during a
// normal session - it's granted/revoked explicitly by syncIdleGlobalEffect
// below (based on isPartyResting()) rather than through the timer-based
// expiry Deaths Door/Healing rely on.
const IDLE_EFFECT_DURATION_TICKS = 60 * 60 * 24 * 365;

// True when the party has nothing else going on - not traveling, gathering, fighting, or recovering.
export function isPartyResting(): boolean {
  return (
    gamestate().world.travel.status === 'Idle' &&
    !isGathering() &&
    !currentCombat() &&
    !isGlobalEffectActive('Deaths Door' as GlobalEffectId) &&
    !isGlobalEffectActive('Healing' as GlobalEffectId)
  );
}

// Only toggles on a state change - addGlobalEffect doesn't dedupe, so calling it every tick would duplicate entries.
function syncIdleGlobalEffect(resting: boolean): void {
  const isIdleActive = isGlobalEffectActive('Idle' as GlobalEffectId);
  if (resting === isIdleActive) return;

  if (resting) {
    addGlobalEffect('Idle' as GlobalEffectId, IDLE_EFFECT_DURATION_TICKS);
    return;
  }

  const idleContent = getEntry<GlobalEffectContent>('Idle' as GlobalEffectId);
  if (idleContent) removeGlobalEffect(idleContent.id);
}

function restedStat(current: number, max: number): number {
  if (current >= max) return current;
  return clamp(
    current + Math.max(1, Math.round(max * RESTING_REGEN_PERCENT)),
    0,
    max,
  );
}

// Runs once per tick alongside gameloop.ts's other processors - syncs the Idle effect and regens HP/EP while resting.
export function restingProcessTick(): void {
  const resting = isPartyResting();
  syncIdleGlobalEffect(resting);
  if (!resting) return;

  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => ({
      ...character,
      hp: restedStat(character.hp, character.stats.Health),
      ep: restedStat(character.ep, character.stats.Energy),
    }));

    return state;
  });
}
