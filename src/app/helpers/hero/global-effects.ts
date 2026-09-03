import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { getEntriesByType, getEntry } from '@helpers/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  healingTicksForLevel,
  healPartyToFull,
} from '@helpers/hero/character-progress';
import { partyGet } from '@helpers/hero/party';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { currentLocationSet } from '@helpers/world';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
import {
  CombatStatDimension,
  StatusEffectTagDimension,
  type GameState,
  type GlobalEffect,
  type GlobalEffectContent,
  type GlobalEffectEffect,
  type GlobalEffectId,
  type TownContent,
} from '@interfaces';

// Renders a set of effects as short "Label: +N[%]" fragments, comma-joined - for
// appending live numbers onto a buff's tooltip description (e.g. town reputation buffs).
export function globalEffectEffectsDescription(
  effects: GlobalEffectEffect[],
): string {
  return effects
    .map((effect) => {
      switch (effect.effectType) {
        case 'GainStats':
          return `${effect.stat}: +${effect.value}`;
        case 'GainCombatStat': {
          const isPercent =
            CombatStatDimension.isPercent?.[effect.combatStat] ?? true;
          return `${CombatStatDimension.label[effect.combatStat]}: +${effect.value}${isPercent ? '%' : ''}`;
        }
        case 'GlobalXPGainMultiplier':
          return `XP Gain: +${effect.value * 100}%`;
        case 'DebuffResistance':
          return `All Debuff Resist: +${effect.value}%`;
        case 'DebuffResistanceTag':
          return `${StatusEffectTagDimension.label[effect.tag]}: +${effect.value}%`;
      }
    })
    .join(', ');
}

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

// Bypasses travel.ts's normal resync (would import back into this file) - identifies
// town buffs by cross-referencing each town's own authored globalEffectId instead.
function clearRegionalBuffs(): void {
  const townBuffIds = new Set(
    getEntriesByType<TownContent>('town').map(
      (town) => town.reputation.buff.globalEffectId,
    ),
  );

  gamestate()
    .globalEffects.filter((effect) => townBuffIds.has(effect.id))
    .forEach((effect) => removeGlobalEffect(effect.id));
}

// Deaths Door is a pure timer; on expiry the party teleports to the kingdom before healing begins there.
function handleDeathsDoorExpiry(): void {
  const kingdom = worldNodesOfType('Kingdom')[0];
  if (kingdom) {
    currentLocationSet({
      mapName: kingdom.mapName,
      x: kingdom.x,
      y: kingdom.y,
    });
  }

  clearRegionalBuffs();
  miscellaneousMessageLog('The party has been recalled to the kingdom.');
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
