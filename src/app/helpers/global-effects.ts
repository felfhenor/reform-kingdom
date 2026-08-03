import { miscellaneousMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { healingTicksForLevel, healPartyToFull, partyGet } from '@helpers/party';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { timerTicksElapsed } from '@helpers/timer';
import { currentLocationSet } from '@helpers/world';
import { worldNodesOfType } from '@helpers/world-nodes';
import type {
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

// Accepts either a content id or a content name (see `getEntry`) so callers
// can use the same readable literal (e.g. `'Healing' as GlobalEffectId`)
// `addGlobalEffect` uses to grant the effect in the first place - stored
// effects are keyed by their real content id, not that literal.
export function isGlobalEffectActive(globalEffectId: GlobalEffectId): boolean {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return false;

  return activeGlobalEffects().some((effect) => effect.id === content.id);
}

export function addGlobalEffect(
  globalEffectId: GlobalEffectId,
  durationTicks: number,
): void {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return;

  const currentTick = timerTicksElapsed();

  updateGamestate((state) => {
    state.globalEffects.push({
      ...content,
      startTick: currentTick,
      expiresAtTick: currentTick + durationTicks,
    });

    return state;
  });
}

export function removeGlobalEffect(id: GlobalEffectId): void {
  updateGamestate((state) => {
    state.globalEffects = state.globalEffects.filter(
      (effect) => effect.id !== id,
    );

    return state;
  });
}

// Deaths Door is a pure timer - the party doesn't walk anywhere while it's
// active. On expiry they're teleported straight to the kingdom, then healing
// begins (so healing only ever starts once they're actually there).
function handleDeathsDoorExpiry(): void {
  const kingdom = worldNodesOfType('Kingdom')[0];
  if (kingdom) {
    currentLocationSet({ mapName: kingdom.mapName, x: kingdom.x, y: kingdom.y });
  }

  miscellaneousMessageLog('The party has been recalled to the kingdom.');
  addGlobalEffect('Healing' as GlobalEffectId, healingTicksForLevel(partyGet()));
}

// Effects never remove themselves - `activeGlobalEffects` just filters them
// out of view once expired - so this drives their expiry side effects and
// sweeps them out of state. Meant to run once per game tick.
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
