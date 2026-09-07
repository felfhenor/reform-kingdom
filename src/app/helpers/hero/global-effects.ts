import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  healingTicksForLevel,
  healPartyToFull,
} from '@helpers/hero/character-progress';
import {
  applyGlobalEffectAdd,
  applyGlobalEffectRemove,
} from '@helpers/hero/global-effect-state';
import { partyGet } from '@helpers/hero/party';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townReputationBuffSync } from '@helpers/town/reputation/town-reputation-buff';
import { homeNodeGet } from '@helpers/town/town-spawn';
import { currentLocationGet, currentLocationSet } from '@helpers/world';
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

// Deaths Door is a pure timer; on expiry the party teleports home (a designated Town, or the Duchy) before healing begins there.
function handleDeathsDoorExpiry(): void {
  const previousMapName = currentLocationGet().mapName;
  const home = homeNodeGet();
  if (home) {
    currentLocationSet({
      mapName: home.mapName,
      x: home.x,
      y: home.y,
    });
    townReputationBuffSync(previousMapName, home.mapName);
  }

  miscellaneousMessageLog('The party has been recalled home.');
  addGlobalEffect(
    'Healing' as GlobalEffectId,
    healingTicksForLevel(partyGet()),
  );
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
