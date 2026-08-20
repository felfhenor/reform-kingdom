import { healingTicksForLevel, healPartyToFull } from '@helpers/character-progress';
import { miscellaneousMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/party';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { timerTicksElapsed } from '@helpers/timer';
import { currentLocationSet } from '@helpers/world';
import { worldNodesOfType } from '@helpers/world-nodes';
import type {
  GameState,
  GlobalEffect,
  GlobalEffectContent,
  GlobalEffectId,
} from '@interfaces';

export function activeGlobalEffects(): GlobalEffect[] {
  const currentTick = timerTicksElapsed();
  return gamestate().globalEffects.filter(
    (effect) => effect.expiresAtTick > currentTick,
  );
}

// Accepts either a content id or name (see `getEntry`) so callers can use the same readable literal `addGlobalEffect` grants with.
export function isGlobalEffectActive(globalEffectId: GlobalEffectId): boolean {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return false;

  return activeGlobalEffects().some((effect) => effect.id === content.id);
}

// Direct-state mutators for callers folding this into a larger `updateGamestate` commit - mirrors `applyMaterialDelta` in `materials.ts`.
export function applyGlobalEffectAdd(
  state: GameState,
  globalEffectId: GlobalEffectId,
  durationTicks: number,
  currentTick: number,
): void {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return;

  state.globalEffects.push({
    ...content,
    startTick: currentTick,
    expiresAtTick: currentTick + durationTicks,
  });
}

export function applyGlobalEffectRemove(
  state: GameState,
  id: GlobalEffectId,
): void {
  state.globalEffects = state.globalEffects.filter(
    (effect) => effect.id !== id,
  );
}

export function addGlobalEffect(
  globalEffectId: GlobalEffectId,
  durationTicks: number,
): void {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return;

  const currentTick = timerTicksElapsed();

  updateGamestate((state) => {
    applyGlobalEffectAdd(state, globalEffectId, durationTicks, currentTick);
    return state;
  });
}

export function removeGlobalEffect(id: GlobalEffectId): void {
  updateGamestate((state) => {
    applyGlobalEffectRemove(state, id);
    return state;
  });
}

// Deaths Door is a pure timer; on expiry the party teleports to the kingdom before healing begins there.
function handleDeathsDoorExpiry(): void {
  const kingdom = worldNodesOfType('Kingdom')[0];
  if (kingdom) {
    currentLocationSet({ mapName: kingdom.mapName, x: kingdom.x, y: kingdom.y });
  }

  miscellaneousMessageLog('The party has been recalled to the kingdom.');
  addGlobalEffect('Healing' as GlobalEffectId, healingTicksForLevel(partyGet()));
}

// Effects never remove themselves; this drives expiry side effects and sweeps them out of state. Run once per game tick.
export function globalEffectsProcessTick(): void {
  const currentTick = timerTicksElapsed();
  const expiredEffects = gamestate().globalEffects.filter(
    (effect) => effect.expiresAtTick <= currentTick,
  );

  const healingContent = getEntry<GlobalEffectContent>(
    'Healing' as GlobalEffectId,
  );
  const deathsDoorContent = getEntry<GlobalEffectContent>(
    'Deaths Door' as GlobalEffectId,
  );

  expiredEffects.forEach((effect) => {
    if (healingContent && effect.id === healingContent.id) {
      miscellaneousMessageLog('The party has finished healing.');
      healPartyToFull();
    }

    if (deathsDoorContent && effect.id === deathsDoorContent.id) {
      handleDeathsDoorExpiry();
    }

    removeGlobalEffect(effect.id);
  });
}

export function globalEffectDurationLabel(effect: GlobalEffect): string {
  const currentTick = timerTicksElapsed();
  const remainingTicks = Math.max(effect.expiresAtTick - currentTick, 0);

  if (remainingTicks >= 3600) return `${Math.round(remainingTicks / 3600)}h`;
  if (remainingTicks >= 60) return `${Math.round(remainingTicks / 60)}m`;
  return `${remainingTicks}s`;
}
