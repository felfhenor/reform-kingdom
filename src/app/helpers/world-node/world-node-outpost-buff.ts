import {
  ONE_YEAR_TICKS,
  OUTPOST_TRAVEL_SPEED_BONUS_PER_LEVEL,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  applyGlobalEffectPush,
  applyGlobalEffectRemove,
  globalEffectEffectsDescription,
} from '@helpers/hero/global-effect-state';
import { updateGamestate } from '@helpers/state-game';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
import type {
  GameState,
  GlobalEffectContent,
  GlobalEffectEffect,
  GlobalEffectId,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

export function outpostBuffMapLevel(state: GameState, mapName: string): number {
  return sumBy(
    worldNodesOfType('Outpost').filter((entry) => entry.mapName === mapName),
    (entry) => state.outposts?.[entry.nodeName]?.level ?? 0,
  );
}

export function outpostBuffEffects(level: number): GlobalEffectEffect[] {
  const value = level * OUTPOST_TRAVEL_SPEED_BONUS_PER_LEVEL;
  return [
    { effectType: 'GlobalOnPathTravelSpeedBoost', value },
    { effectType: 'GlobalOffPathTravelSpeedBoost', value },
  ];
}

// Mutates `state`; one shared effect is enough since only the current map's outposts apply.
export function applyOutpostBuffRefresh(
  state: GameState,
  mapName: string,
): void {
  const content = getEntry<GlobalEffectContent>(
    'Regional Outpost' as GlobalEffectId,
  );
  if (!content) return;

  applyGlobalEffectRemove(state, content.id);

  const level = outpostBuffMapLevel(state, mapName);
  if (level === 0) return;

  const effects = outpostBuffEffects(level);
  const currentTick = state.clock.numTicks;
  applyGlobalEffectPush(state, {
    ...content,
    effects,
    extendedDescription: globalEffectEffectsDescription(effects),
    startTick: currentTick,
    expiresAtTick: currentTick + ONE_YEAR_TICKS,
  });
}

export function outpostBuffRefresh(mapName: string): void {
  updateGamestate((state) => {
    applyOutpostBuffRefresh(state, mapName);
    return state;
  });
}
