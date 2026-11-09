import { getEntry } from '@helpers/content/content';
import { defaultGlobalEffectSums } from '@helpers/defaults';
import { characterRecalculateStats } from '@helpers/hero/party';
import {
  CombatStatDimension,
  StatShorthand,
  StatusEffectTagDimension,
  type CollectibleContent,
  type CollectibleId,
  type EdictContent,
  type GameStat,
  type GameState,
  type GlobalEffect,
  type GlobalEffectContent,
  type GlobalEffectEffect,
  type GlobalEffectId,
  type GlobalEffectSums,
  type StatBlock,
  type TradeskillContent,
  type WorldNodeType,
} from '@interfaces';
import { isEqual } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

const WORLD_NODE_TYPE_LABELS: Record<WorldNodeType, string> = {
  Kingdom: 'Duchies',
  NonPlayerKingdom: 'Towns',
  CaravanNode: 'Caravans',
  ExploreNode: 'Encounters',
  ExploreRandomNode: 'Mystical locations',
  GatherNode: 'Gather locations',
  Shrine: 'Shrines',
  Outpost: 'Outposts',
  Trainer: 'Trainers',
  ExchangeNode: 'Exchanges',
  TeleportNode: 'Teleports',
  CollectibleGate: 'Gates',
};

// Rounded so scaled fractions (0.15 * 100) don't print float noise.
function signedNumber(value: number): string {
  return `${value >= 0 ? '+' : ''}${round(value, 2)}`;
}

function signedPercent(value: number): string {
  return `${signedNumber(value)}%`;
}

function addStatPercent(
  percents: StatBlock,
  value: number,
  stat?: GameStat,
): void {
  (stat ? [stat] : (Object.keys(percents) as GameStat[])).forEach((key) => {
    percents[key] += value;
  });
}

// Renders one effect as a short "Label: +N[%]" fragment.
export function globalEffectEffectDescription(
  effect: GlobalEffectEffect,
): string {
  switch (effect.effectType) {
    case 'GainStats':
      return `Hero ${StatShorthand[effect.stat]}: ${signedNumber(effect.value)}`;
    case 'GainStatPercent':
      return `Hero ${StatShorthand[effect.stat!] ?? 'stats'}: ${signedPercent(effect.value)}`;
    case 'EnemyStatPercent':
      return `Enemy ${StatShorthand[effect.stat!] ?? 'stats'}: ${signedPercent(effect.value)}`;
    case 'GainCombatStat': {
      const isPercent =
        CombatStatDimension.isPercent?.[effect.combatStat] ?? true;
      return `Hero ${CombatStatDimension.label[effect.combatStat]}: +${effect.value}${isPercent ? '%' : ''}`;
    }
    case 'GlobalXPGainMultiplier':
      return `XP Gain: ${signedPercent(effect.value * 100)}`;
    case 'GlobalGoldGainMultiplier':
      return `Gold Gain: ${signedPercent(effect.value * 100)}`;
    case 'GlobalShopPriceMultiplier':
      return `Shop Prices: ${signedPercent(effect.value * 100)}`;
    case 'GlobalTraderPriceMultiplier':
      return `Trader Prices: ${signedPercent(effect.value * 100)}`;
    case 'GlobalShrineBuffsPermanent':
      return 'Shrine buffs never expire';
    case 'GlobalWipeEndsRun':
      return 'Dying is game over';
    case 'WorkerCraftSpeedPercent':
      return `Worker Craft Speed: ${signedPercent(effect.value)}`;
    case 'WorkerGatherSpeedPercent':
      return `Worker Gather Speed: ${signedPercent(effect.value)}`;
    case 'GlobalTownShopNoEquipment':
      return 'Town shops sell no equipment';
    case 'GlobalFeaturesRevealed':
      return 'Level-based features always available';
    case 'GlobalCursedDrops':
      return 'Combat-dropped gear is cursed';
    case 'GlobalDropExtraAffixes':
      return `Combat-dropped Gear Affixes: +${effect.value}`;
    case 'GlobalCraftedExtraAffixes':
      return `Crafted Gear Affixes: +${effect.value}`;
    case 'GlobalRecipeMaterialBoost':
      return `Recipe Materials: ${signedNumber(effect.value)} each`;
    case 'GlobalCraftTimeMultiplier':
      return `Craft Time: ${signedPercent(effect.value * 100)}`;
    case 'GlobalSkillPointsPerLevel':
      return Math.abs(effect.value) >= 1
        ? `Skill Points: ${signedNumber(effect.value)} per level`
        : `Skill Points: ${signedNumber(Math.sign(effect.value))} every ${Math.round(1 / Math.abs(effect.value))} levels`;
    case 'GlobalReclassDisabled':
      return 'Heroes cannot reclass';
    case 'GlobalPartySharesClass':
      return 'Every hero shares one class';
    case 'GlobalJobAbilitiesStack':
      return 'Party job abilities stack';
    case 'GlobalWorldNodeTypeRemoved':
      return `${WORLD_NODE_TYPE_LABELS[effect.nodeType]} are gone`;
    case 'GlobalWorldNodeStartingLevel':
      return `${WORLD_NODE_TYPE_LABELS[effect.nodeType]} start at +${effect.value}`;
    case 'GlobalCommissionReputationBoost':
      return `Commission Reputation: ${signedPercent(effect.value * 100)}`;
    case 'GlobalTownCommissionSlotBoost':
      return `Town Commission Slots: ${signedNumber(effect.value)}`;
    case 'GlobalShrineBuffDuration':
      return `Shrine Buff Duration: ${signedPercent(effect.value * 100)}`;
    case 'GlobalShrineBuffStrength':
      return `Shrine Buff Strength: ${signedPercent(effect.value * 100)}`;
    case 'GlobalAstralSpellDuration':
      return `Astral Spell Duration: ${signedPercent(effect.value * 100)}`;
    case 'GlobalAstralSpellStrength':
      return `Astral Spell Strength: ${signedPercent(effect.value * 100)}`;
    case 'EnemyExtraSkills':
      return `Enemy Skills: +${effect.value}`;
    case 'GlobalLevelStatMultiplier':
      return `Stats/Lv.: ${signedPercent(effect.value * 100)}`;
    case 'GlobalDeathPenaltyMultiplier':
      return `Deaths Door & Healing Time: ${signedPercent(effect.value * 100)}`;
    case 'DebuffResistance':
      return `All Debuff Resist: +${effect.value}%`;
    case 'DebuffResistanceTag':
      return `${StatusEffectTagDimension.label[effect.tag]}: +${effect.value}%`;
    case 'GlobalCombatItemDropRateBoost':
      return `Item Drop Chance: ${signedPercent(effect.value)}`;
    case 'GlobalGatheringItemDropRateBoost':
      return `Lucky Gather Item Chance: ${signedPercent(effect.value)}`;
    case 'GlobalGatheringItemDropAmountBoost':
      return `Lucky Gather Items on Success: ${signedNumber(effect.value)}`;
    case 'GlobalGatheringItemFlatBoost':
      return `Guaranteed Gather Items: ${signedNumber(effect.value)}`;
    case 'GlobalArmorySizeBoost':
      return `Armory Size: +${effect.value}`;
    case 'GlobalTradeskillQueueSizeBoost': {
      const tradeskillName =
        getEntry<TradeskillContent>(effect.tradeskillId)?.name ??
        'Unknown Tradeskill';
      return `${tradeskillName} Queue Size: +${effect.value}`;
    }
    case 'GlobalOffPathTravelSpeedBoost':
      return `Off-Path Travel Speed: ${signedPercent(effect.value * 100)}`;
    case 'GlobalOnPathTravelSpeedBoost':
      return `On-Path Travel Speed: ${signedPercent(effect.value * 100)}`;
    case 'GlobalDecreeClauseCapBoost':
      return `Decree Clause Cap: +${effect.value}`;
  }
}

// Comma-joined fragments - for appending live numbers onto a buff's tooltip
// description (e.g. town reputation buffs).
export function globalEffectEffectsDescription(
  effects: GlobalEffectEffect[],
): string {
  return effects.map(globalEffectEffectDescription).join(', ');
}

export function globalEffectDescription(
  effect: Pick<GlobalEffectContent, 'description' | 'effects'>,
): string {
  return effect.description || globalEffectEffectsDescription(effect.effects);
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
    case 'GainStatPercent':
      addStatPercent(sums.heroStatPercents, effect.value, effect.stat);
      return;
    case 'EnemyStatPercent':
      addStatPercent(sums.enemyStatPercents, effect.value, effect.stat);
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
    case 'GlobalShopPriceMultiplier':
      sums.shopPriceMultiplierBonus += effect.value;
      return;
    case 'GlobalTraderPriceMultiplier':
      sums.traderPriceMultiplierBonus += effect.value;
      return;
    case 'GlobalDeathPenaltyMultiplier':
      sums.deathPenaltyMultiplierBonus += effect.value;
      return;
    case 'GlobalLevelStatMultiplier':
      sums.levelStatMultiplierBonus += effect.value;
      return;
    case 'GlobalShrineBuffsPermanent':
      sums.shrineBuffsPermanent = true;
      return;
    case 'EnemyExtraSkills':
      sums.enemyExtraSkills += effect.value;
      return;
    case 'GlobalWipeEndsRun':
      sums.wipeEndsRun = true;
      return;
    case 'WorkerCraftSpeedPercent':
      sums.workerCraftSpeedPercent += effect.value;
      return;
    case 'WorkerGatherSpeedPercent':
      sums.workerGatherSpeedPercent += effect.value;
      return;
    case 'GlobalTownShopNoEquipment':
      sums.townShopNoEquipment = true;
      return;
    case 'GlobalFeaturesRevealed':
      sums.featuresRevealed = true;
      return;
    case 'GlobalCursedDrops':
      sums.cursedDrops = true;
      return;
    case 'GlobalDropExtraAffixes':
      sums.dropExtraAffixes += effect.value;
      return;
    case 'GlobalCraftedExtraAffixes':
      sums.craftedExtraAffixes += effect.value;
      return;
    case 'GlobalRecipeMaterialBoost':
      sums.recipeMaterialBoost += effect.value;
      return;
    case 'GlobalCraftTimeMultiplier':
      sums.craftTimeMultiplierBonus += effect.value;
      return;
    case 'GlobalSkillPointsPerLevel':
      sums.skillPointsPerLevel += effect.value;
      return;
    case 'GlobalReclassDisabled':
      sums.reclassDisabled = true;
      return;
    case 'GlobalPartySharesClass':
      sums.partySharesClass = true;
      return;
    case 'GlobalJobAbilitiesStack':
      sums.jobAbilitiesStack = true;
      return;
    case 'GlobalWorldNodeTypeRemoved':
      sums.removedWorldNodeTypes[effect.nodeType] = true;
      return;
    case 'GlobalWorldNodeStartingLevel':
      sums.worldNodeStartingLevels[effect.nodeType] =
        (sums.worldNodeStartingLevels[effect.nodeType] ?? 0) + effect.value;
      return;
    case 'GlobalCommissionReputationBoost':
      sums.commissionReputationBonus += effect.value;
      return;
    case 'GlobalTownCommissionSlotBoost':
      sums.townCommissionSlotBoost += effect.value;
      return;
    case 'GlobalShrineBuffDuration':
      sums.shrineBuffDurationBonus += effect.value;
      return;
    case 'GlobalShrineBuffStrength':
      sums.shrineBuffStrengthBonus += effect.value;
      return;
    case 'GlobalAstralSpellDuration':
      sums.astralSpellDurationBonus += effect.value;
      return;
    case 'GlobalAstralSpellStrength':
      sums.astralSpellStrengthBonus += effect.value;
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
    case 'GlobalGatheringItemDropAmountBoost':
      sums.gatheringItemDropAmountBoost += effect.value;
      return;
    case 'GlobalGatheringItemFlatBoost':
      sums.gatheringItemFlatBoost += effect.value;
      return;
    case 'GlobalArmorySizeBoost':
      sums.armorySizeBoost += effect.value;
      return;
    case 'GlobalTradeskillQueueSizeBoost':
      sums.tradeskillQueueSizeBoosts[effect.tradeskillId] =
        (sums.tradeskillQueueSizeBoosts[effect.tradeskillId] ?? 0) +
        effect.value;
      return;
    case 'GlobalOffPathTravelSpeedBoost':
      sums.offPathTravelSpeedBonus += effect.value;
      return;
    case 'GlobalOnPathTravelSpeedBoost':
      sums.onPathTravelSpeedBonus += effect.value;
      return;
    case 'GlobalDecreeClauseCapBoost':
      sums.decreeClauseCapBoost += effect.value;
      return;
    default:
      assertNeverGlobalEffectEffect(effect);
  }
}

export function globalEffectSumsOf(
  effects: GlobalEffectEffect[],
): GlobalEffectSums {
  const sums = defaultGlobalEffectSums();
  effects.forEach((effect) => accumulateGlobalEffectEffect(sums, effect));
  return sums;
}

// Totals of every timed effect, owned collectible and run edict, without writing them anywhere.
export function globalEffectSumsFor(state: GameState): GlobalEffectSums {
  const activeEffectEntries = state.globalEffects
    .filter((effect) => effect.expiresAtTick > state.clock.numTicks)
    .flatMap((effect) => effect.effects);

  const collectibleEffectEntries = (
    Object.keys(state.collectibles) as CollectibleId[]
  ).flatMap((id) => getEntry<CollectibleContent>(id)?.effects ?? []);

  const edictEffectEntries = state.edicts.flatMap(
    (id) => getEntry<EdictContent>(id)?.effects ?? [],
  );

  return globalEffectSumsOf([
    ...activeEffectEntries,
    ...collectibleEffectEntries,
    ...edictEffectEntries,
  ]);
}

export function recomputeGlobalEffectSums(state: GameState): void {
  const sums = globalEffectSumsFor(state);
  const previous = state.globalEffectSums;
  const heroStatsChanged =
    !isEqual(previous?.heroStatPercents, sums.heroStatPercents) ||
    previous?.levelStatMultiplierBonus !== sums.levelStatMultiplierBonus;
  state.globalEffectSums = sums;

  // Hero stats are cached on each character, so a change to what scales them has to be rolled in.
  if (heroStatsChanged) {
    state.world.party = state.world.party.map((hero) =>
      characterRecalculateStats(hero, sums),
    );
  }
}

// Direct-state mutators for callers folding this into a larger `updateGamestate` commit.
export function applyGlobalEffectPush(
  state: GameState,
  effect: GlobalEffect,
): void {
  state.globalEffects = [...state.globalEffects, effect];
  recomputeGlobalEffectSums(state);
}

// Flag effects have no value to scale, so they pass through unchanged.
export function globalEffectEffectsScaled(
  effects: GlobalEffectEffect[],
  multiplier: number,
): GlobalEffectEffect[] {
  return effects.map((effect) =>
    'value' in effect
      ? { ...effect, value: effect.value * multiplier }
      : effect,
  );
}

export function applyGlobalEffectAdd(
  state: GameState,
  globalEffectId: GlobalEffectId,
  durationTicks: number,
  currentTick: number,
  hideDuration = false,
  valueMultiplier = 1,
): void {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return;

  applyGlobalEffectPush(state, {
    ...content,
    effects: globalEffectEffectsScaled(content.effects, valueMultiplier),
    hideDuration: hideDuration || content.hideDuration,
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
