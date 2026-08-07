import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import { isGathering } from '@helpers/gathering';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/global-effects';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { GlobalEffectContent, GlobalEffectId } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

const RESTING_REGEN_PERCENT = 0.01;

// Long enough that the Idle global effect never expires on its own during a
// normal session - it's granted/revoked explicitly by syncIdleGlobalEffect
// below (based on isPartyResting()) rather than through the timer-based
// expiry Deaths Door/Healing rely on.
const IDLE_EFFECT_DURATION_TICKS = 60 * 60 * 24 * 365;

// True whenever the party has nothing else going on - not traveling,
// gathering, fighting, or recovering from Deaths Door/Healing (those already
// have their own global effects, and Healing already restores the party in
// full on expiry) - so sitting at a location with nothing queued reads as
// "resting" rather than just quietly doing nothing.
export function isPartyResting(): boolean {
  return (
    gamestate().world.travel.status === 'Idle' &&
    !isGathering() &&
    !currentCombat() &&
    !isGlobalEffectActive('Deaths Door' as GlobalEffectId) &&
    !isGlobalEffectActive('Healing' as GlobalEffectId)
  );
}

// Grants/revokes the Idle global effect to match isPartyResting(), so it
// shows up in the existing global-effect-bar UI exactly like Deaths
// Door/Healing. Only toggles on a state change - addGlobalEffect doesn't
// dedupe by id, so calling it every tick would push a fresh duplicate entry
// into state each time instead of refreshing the existing one.
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

// Meant to run once per game tick, alongside the other tick processors in
// gameloop.ts - keeps the Idle global effect in sync and regenerates a
// little HP/EP for every hero while the party is resting (see
// isPartyResting), so waiting at a location isn't purely dead time between
// actions.
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
