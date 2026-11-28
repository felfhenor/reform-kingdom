import { enumLabel, t } from '@helpers/i18n/i18n';
import { contentNameById } from '@helpers/i18n/i18n-content';
import { getEntry } from '@helpers/content/content';
import { defaultGlobalEffectSums } from '@helpers/defaults';
import { edictEntry, edictSeatBoons } from '@helpers/edict/edict';
import { characterRecalculateStats } from '@helpers/hero/party';
import {
  CombatStatDimension,
  StatusEffectTagDimension,
  type CollectibleContent,
  type CombatStat,
  type CollectibleId,
  type GameStat,
  type GameState,
  type GlobalEffect,
  type GlobalEffectContent,
  type GlobalEffectEffect,
  type GlobalEffectId,
  type GlobalEffectSums,
  type I18nParams,
  type StatBlock,
  type StatusEffectTag,
  type WorldNodeType,
} from '@interfaces';
import { isEqual } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

const WORLD_NODE_TYPE_LABELS: Record<WorldNodeType, string> = {
  Kingdom: 'Duchies',
  NonPlayerKingdom: 'Towns',
  CaravanNode: 'Caravans',
  ExploreNode: 'Encounters',
  ExploreRandomNode: 'Mystical Locations',
  GatherNode: 'Gather Locations',
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

function globalEffectTextKey(
  effect: GlobalEffectEffect,
): `globalEffect.${GlobalEffectEffect['effectType'] | 'GainCombatStatFlat' | 'GlobalSkillPointsPerLevelSlow'}` {
  if (effect.effectType === 'GainCombatStat') {
    const isPercent =
      CombatStatDimension.isPercent?.[effect.combatStat] ?? true;
    return isPercent
      ? 'globalEffect.GainCombatStat'
      : 'globalEffect.GainCombatStatFlat';
  }
  if (effect.effectType === 'GlobalSkillPointsPerLevel') {
    return Math.abs(effect.value) >= 1
      ? 'globalEffect.GlobalSkillPointsPerLevel'
      : 'globalEffect.GlobalSkillPointsPerLevelSlow';
  }
  return `globalEffect.${effect.effectType}`;
}

// Every value an effect's text might use; each translation picks the ones it needs.
function globalEffectTextParams(effect: GlobalEffectEffect): I18nParams {
  const fields = effect as Partial<Record<string, string | number>>;
  const value = Number(fields['value'] ?? 0);
  const stat = fields['stat'];
  const combatStat = fields['combatStat'];
  const nodeType = fields['nodeType'];
  const tag = fields['tag'];
  const tradeskillId = fields['tradeskillId'];
  return {
    value,
    signed: signedNumber(value),
    signedOne: signedNumber(Math.sign(value)),
    levels: value === 0 ? 0 : Math.round(1 / Math.abs(value)),
    percent: signedPercent(value),
    percent100: signedPercent(value * 100),
    stat: stat
      ? enumLabel('statShort', String(stat))
      : t('globalEffect.anyStat'),
    combatStat: combatStat
      ? CombatStatDimension.label[combatStat as CombatStat]
      : '',
    materialPercent: fields['materialPercent'] ?? 0,
    materialSelectionPercent: fields['materialSelectionPercent'] ?? 0,
    nodeType: nodeType ? WORLD_NODE_TYPE_LABELS[nodeType as WorldNodeType] : '',
    tag: tag ? StatusEffectTagDimension.label[tag as StatusEffectTag] : '',
    tradeskill: tradeskillId
      ? (contentNameById(String(tradeskillId)) ??
        t('globalEffect.unknownTradeskill'))
      : '',
  };
}

export function globalEffectEffectDescription(
  effect: GlobalEffectEffect,
): string {
  return t(globalEffectTextKey(effect), globalEffectTextParams(effect));
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
    case 'GlobalWipeLosesCurrency':
      sums.wipeCurrencyLossPercent += effect.value;
      return;
    case 'GlobalWipeLosesMaterials':
      sums.wipeMaterialPercent += effect.materialPercent;
      sums.wipeMaterialSelectionPercent += effect.materialSelectionPercent;
      return;
    case 'GlobalReviveInPlace':
      sums.reviveInPlace = true;
      return;
    case 'WorkerCraftSpeedPercent':
      sums.workerCraftSpeedPercent += effect.value;
      return;
    case 'WorkerGatherSpeedPercent':
      sums.workerGatherSpeedPercent += effect.value;
      return;
    case 'WorkerXPGainMultiplier':
      sums.workerXpGainMultiplierBonus += effect.value;
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
    case 'GlobalTradeskillMaterialBoost':
      sums.tradeskillMaterialBoost += effect.value;
      return;
    case 'GlobalAstralProjectorMaterialBoost':
      sums.astralProjectorMaterialBoost += effect.value;
      return;
    case 'GlobalDevelopMaterialBoost':
      sums.developMaterialBoost += effect.value;
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
    case 'GlobalTradeskillsDisabled':
      sums.tradeskillsDisabled = true;
      return;
    case 'GlobalWorkersDisabled':
      sums.workersDisabled = true;
      return;
    case 'GlobalManualCombat':
      sums.manualCombat = true;
      return;
    case 'GlobalRequireSealForDecreeAutomation':
      sums.requireSealForDecreeAutomation = true;
      return;
    case 'GlobalPartySharesClass':
      sums.partySharesClass = true;
      return;
    case 'GlobalJobAbilitiesStack':
      sums.jobAbilitiesStack = true;
      return;
    case 'GlobalShowRunTimer':
      sums.showRunTimer = true;
      return;
    case 'GlobalSkipRegionIntros':
      sums.skipRegionIntros = true;
      return;
    case 'GlobalSkipTutorials':
      sums.skipTutorials = true;
      return;
    case 'GlobalSkipStoryCrawls':
      sums.skipStoryCrawls = true;
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
    case 'GlobalMonstersDropRegionGathering':
      sums.regionGatheringDropChance += effect.value;
      return;
    case 'GlobalMonstersDropRegionGear':
      sums.regionGearDropChance += effect.value;
      return;
    case 'GlobalMonstersDropRegionCraftedMaterials':
      sums.regionMaterialDropChance += effect.value;
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

// Totals of every timed effect, owned collectible, run edict and its seat boons, without writing them anywhere.
export function globalEffectSumsFor(state: GameState): GlobalEffectSums {
  const activeEffectEntries = state.globalEffects
    .filter((effect) => effect.expiresAtTick > state.clock.numTicks)
    .flatMap((effect) => effect.effects);

  const collectibleEffectEntries = (
    Object.keys(state.collectibles) as CollectibleId[]
  ).flatMap((id) => getEntry<CollectibleContent>(id)?.effects ?? []);

  const edictEffectEntries = state.edicts.flatMap((id) => {
    const edict = edictEntry(id);
    if (!edict) return [];
    return [
      ...(edict.effects ?? []),
      ...edictSeatBoons(edict).flatMap((seatBoon) => seatBoon.effects),
    ];
  });

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
