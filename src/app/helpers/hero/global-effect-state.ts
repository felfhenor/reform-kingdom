import { getEntry } from '@helpers/content/content';
import { defaultGlobalEffectSums } from '@helpers/defaults';
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  CombatStatDimension,
  StatusEffectTagDimension,
  type CollectibleContent,
  type CollectibleId,
  type GameState,
  type GlobalEffect,
  type GlobalEffectContent,
  type GlobalEffectEffect,
  type GlobalEffectId,
  type GlobalEffectSums,
} from '@interfaces';

// Renders one effect as a short "Label: +N[%]" fragment.
export function globalEffectEffectDescription(
  effect: GlobalEffectEffect,
): string {
  switch (effect.effectType) {
    case 'GainStats':
      return `Hero Combat ${effect.stat}: +${effect.value}`;
    case 'GainCombatStat': {
      const isPercent =
        CombatStatDimension.isPercent?.[effect.combatStat] ?? true;
      return `Hero Combat ${CombatStatDimension.label[effect.combatStat]}: +${effect.value}${isPercent ? '%' : ''}`;
    }
    case 'GlobalXPGainMultiplier':
      return `XP Gain: +${effect.value * 100}%`;
    case 'GlobalGoldGainMultiplier':
      return `Gold Gain: +${effect.value * 100}%`;
    case 'DebuffResistance':
      return `All Debuff Resist: +${effect.value}%`;
    case 'DebuffResistanceTag':
      return `${StatusEffectTagDimension.label[effect.tag]}: +${effect.value}%`;
    case 'GlobalCombatItemDropRateBoost':
      return `Item Drop Chance: +${effect.value}%`;
    case 'GlobalGatheringItemDropRateBoost':
      return `Extra Gather Item Chance: +${effect.value}%`;
    case 'GlobalArmorySizeBoost':
      return `Armory Size: +${effect.value}`;
  }
}

// Comma-joined fragments - for appending live numbers onto a buff's tooltip
// description (e.g. town reputation buffs).
export function globalEffectEffectsDescription(
  effects: GlobalEffectEffect[],
): string {
  return effects.map(globalEffectEffectDescription).join(', ');
}

function assertNeverGlobalEffectEffect(value: never): never {
  throw new Error(`Unhandled global effect type: ${JSON.stringify(value)}`);
}

function accumulateGlobalEffectEffect(
  sums: GlobalEffectSums,
  effect: GlobalEffectEffect,
): void {
  switch (effect.effectType) {
    case 'GainStats':
      sums.stats[effect.stat] += effect.value;
      return;
    case 'GainCombatStat':
      sums.combatStats[effect.combatStat] += effect.value;
      return;
    case 'GlobalXPGainMultiplier':
      sums.xpGainMultiplierBonus += effect.value;
      return;
    case 'GlobalGoldGainMultiplier':
      sums.goldGainMultiplierBonus += effect.value;
      return;
    case 'DebuffResistance':
      sums.debuffResistanceFlat += effect.value;
      return;
    case 'DebuffResistanceTag':
      sums.debuffResistanceTags[effect.tag] += effect.value;
      return;
    case 'GlobalCombatItemDropRateBoost':
      sums.combatItemDropRateBoost += effect.value;
      return;
    case 'GlobalGatheringItemDropRateBoost':
      sums.gatheringItemDropRateBoost += effect.value;
      return;
    case 'GlobalArmorySizeBoost':
      sums.armorySizeBoost += effect.value;
      return;
    default:
      assertNeverGlobalEffectEffect(effect);
  }
}

// Rebuilds `state.globalEffectSums` from scratch - every active (non-expired)
// global effect, plus every owned collectible's effects counted once each
// regardless of quantity (collectibles never stack). Called from the few
// choke points that actually change either source: `applyGlobalEffectPush`,
// `applyGlobalEffectRemove`, and `applyCollectibleGrant`.
export function recomputeGlobalEffectSums(state: GameState): void {
  const currentTick = timerTicksElapsed();

  const activeEffectEntries = state.globalEffects
    .filter((effect) => effect.expiresAtTick > currentTick)
    .flatMap((effect) => effect.effects);

  const collectibleEffectEntries = (
    Object.keys(state.collectibles) as CollectibleId[]
  ).flatMap((id) => getEntry<CollectibleContent>(id)?.effects ?? []);

  const sums = defaultGlobalEffectSums();
  [...activeEffectEntries, ...collectibleEffectEntries].forEach((effect) =>
    accumulateGlobalEffectEffect(sums, effect),
  );

  state.globalEffectSums = sums;
}

// Direct-state mutators for callers folding this into a larger `updateGamestate` commit.
export function applyGlobalEffectPush(
  state: GameState,
  effect: GlobalEffect,
): void {
  state.globalEffects.push(effect);
  recomputeGlobalEffectSums(state);
}

export function applyGlobalEffectAdd(
  state: GameState,
  globalEffectId: GlobalEffectId,
  durationTicks: number,
  currentTick: number,
): void {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return;

  applyGlobalEffectPush(state, {
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
  recomputeGlobalEffectSums(state);
}
