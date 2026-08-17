import { armoryGet } from '@helpers/armory';
import { autoModeToggle } from '@helpers/auto-mode';
import {
  characterInfuseEquipment,
  optimizeCharacterEquipment,
} from '@helpers/character-equipment';
import { getEntriesByType, getEntry } from '@helpers/content';
import { getCraftableRecipeEntries } from '@helpers/crafting';
import { craftMaxCraftableQuantity, craftQueueStart } from '@helpers/crafting-queue';
import {
  decreeClauseAdd,
  decreeClauseReorder,
  decreeClauses,
  decreeClauseSetEnabled,
  decreeSetRiskTolerance,
} from '@helpers/decree';
import { equippedItems, isSlotAvailableForJob } from '@helpers/equipment';
import { isGatherNodeDiscovered } from '@helpers/gather-node-discovery';
import { gatheringStop, isGathering, partyMinLevel } from '@helpers/gathering';
import { canInfuseEquipmentItem, isInfusionMaterial } from '@helpers/infusion';
import { getMaterialQuantity } from '@helpers/materials';
import { partyGet } from '@helpers/party';
import { isRecipeCraftable } from '@helpers/recipes';
import { gamestate } from '@helpers/state-game';
import { tradeskillActiveGate, tradeskillBuilding } from '@helpers/tradeskill';
import { worldNodeGatherMaterialIds } from '@helpers/world-node-gathering';
import {
  isWorldNodeVisible,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type {
  CollectibleId,
  DecreeClauseId,
  EquipmentContent,
  EquipmentId,
  EquipmentSlot,
  ItemContent,
  ItemId,
  JobContent,
  JobId,
  MaterialId,
  RecipeContent,
  RecipeId,
  Tradeskill,
} from '@interfaces';
import { ALL_TRADESKILLS, EquipmentTypeToSlot } from '@interfaces';
import {
  ALWAYS_CRAFT_INTERVAL_TICKS,
  ALWAYS_INFUSE_INTERVAL_TICKS,
  GATHER_MATERIAL_TARGET_QUANTITY,
  GATHER_TIME_BUDGET_FRACTION,
  GATHER_TIMEOUT_TICKS,
  PERIODIC_CRAFT_INTERVAL_TICKS,
  PERIODIC_INFUSE_INTERVAL_TICKS,
} from './constants';
import type { StrategyName } from './types';

// Risk tolerance is no longer a strategy-varying concept (see driver.ts/
// README - the sim now always challenges the hardest node it can reasonably
// reach; see `configureStrategyDecree`). The two tiers below differ *only*
// by how often they attempt to craft/infuse - the point is to isolate
// crafting frequency as the one variable and measure how much it actually
// matters to progression speed.
type StrategyPreset = {
  craftIntervalTicks: number;
  infuseIntervalTicks: number;
};

const STRATEGY_PRESETS: Record<StrategyName, StrategyPreset> = {
  'periodic-craft': {
    craftIntervalTicks: PERIODIC_CRAFT_INTERVAL_TICKS,
    infuseIntervalTicks: PERIODIC_INFUSE_INTERVAL_TICKS,
  },
  'always-craft': {
    craftIntervalTicks: ALWAYS_CRAFT_INTERVAL_TICKS,
    infuseIntervalTicks: ALWAYS_INFUSE_INTERVAL_TICKS,
  },
};

// Sets up the standing Decree clause list, pins risk tolerance to `High` (the
// loosest ceiling - combined with the game's own XP-triviality filter, this
// makes `LevelUpParty` always challenge the hardest node it can reasonably
// reach, backing off via its existing per-node failure-streak tracking when
// losing - see `mostChallengingExploreNodeForRisk` in decree-evaluation.ts),
// and turns Auto Mode on. Called once per scenario, before the tick loop
// starts.
//
// Deliberately does *not* add `GatherMaterial` clauses here - see
// `syncGatherMaterialClauses`, which adds them incrementally as the party's
// level actually allows gathering each one, and must therefore be re-checked
// every tick rather than decided once up front.
export function configureStrategyDecree(): void {
  decreeSetRiskTolerance('High');
  rebuildPartyEquipmentTargets();
  rebuildPartyRelevantMaterialIds();
  resetGatherTimeTracking();

  if (decreeClauses().length === 0) {
    decreeClauseAdd({ type: 'LevelUpParty' });
    decreeClauseAdd({ type: 'FinishUnfinishedAreas' });
    decreeClauseAdd({ type: 'ReturnToKingdom' });
  }

  autoModeToggle(true);
}

export type CraftAttemptResult = {
  // At least one tradeskill has a recipe unlocked (building level high
  // enough) - distinguishes "nothing to craft yet" from "wants to craft but
  // can't", which is what a supply-chain stonewall actually looks like.
  anyRecipeUnlocked: boolean;
  anyQueued: boolean;
};

// --- targeted crafting: capstone gate > party-relevant equipment > fallback ---

// Recipes producing a collectible, keyed by collectible id - built once
// (content is static for the whole process) and reused across every scenario
// and tick. Used to find what unblocks a tradeskill's level-6 "capstone"
// gate (see `tradeskillActiveGate`).
let collectibleRecipeIndexCache: Map<CollectibleId, RecipeContent> | undefined;

function collectibleRecipeIndex(): Map<CollectibleId, RecipeContent> {
  if (!collectibleRecipeIndexCache) {
    collectibleRecipeIndexCache = new Map();
    getEntriesByType<RecipeContent>('recipe').forEach((recipe) => {
      if ('collectibleId' in recipe.result) {
        collectibleRecipeIndexCache!.set(recipe.result.collectibleId, recipe);
      }
    });
  }
  return collectibleRecipeIndexCache;
}

// Recipes producing a piece of equipment, keyed by equipment id - same
// static, process-lifetime cache as `collectibleRecipeIndex`.
let equipmentRecipeIndexCache: Map<EquipmentId, RecipeContent[]> | undefined;

function equipmentRecipeIndex(): Map<EquipmentId, RecipeContent[]> {
  if (!equipmentRecipeIndexCache) {
    equipmentRecipeIndexCache = new Map();
    getEntriesByType<RecipeContent>('recipe').forEach((recipe) => {
      if (!('equipmentId' in recipe.result)) return;

      const list = equipmentRecipeIndexCache!.get(recipe.result.equipmentId) ?? [];
      list.push(recipe);
      equipmentRecipeIndexCache!.set(recipe.result.equipmentId, list);
    });
  }
  return equipmentRecipeIndexCache;
}

// How many additional prerequisite-recipe hops beneath the initially
// targeted recipe will be attempted (so up to `MAX_PREREQ_CHAIN_DEPTH + 1`
// distinct recipes total, including the initial one).
const MAX_PREREQ_CHAIN_DEPTH = 3;

// `quantity` is how many units of `recipe` are ultimately wanted - a short
// requirement needs `requirement.quantity * quantity` in total, not just
// enough for one unit.
function firstShortItemRequirement(
  recipe: RecipeContent,
  quantity: number,
): { itemId: ItemId; quantity: number } | undefined {
  return recipe.requirements.find(
    (requirement): requirement is { itemId: ItemId; quantity: number } =>
      'itemId' in requirement &&
      getMaterialQuantity(requirement.itemId) < requirement.quantity * quantity,
  );
}

function recipeProducingItem(
  tradeskill: Tradeskill,
  itemId: ItemId,
): RecipeContent | undefined {
  return getEntriesByType<RecipeContent>('recipe').find(
    (recipe) =>
      recipe.tradeskill === tradeskill &&
      'itemId' in recipe.result &&
      recipe.result.itemId === itemId,
  );
}

function isRecipeAlreadyQueued(tradeskill: Tradeskill, recipeId: RecipeId): boolean {
  return tradeskillBuilding(tradeskill).queue.some((entry) => entry.recipeId === recipeId);
}

// Attempts to queue `recipe`. If a required item is short, recurses into
// whatever same-tradeskill recipe produces *that* item instead (e.g. Copper
// Ore -> Copper Ingot -> Copper Dagger) - bounded depth plus a visited guard
// against cycles. Doesn't need to resolve a whole chain in one call: queuing
// an intermediate recipe now and letting a later call finish the rest once
// it's actually been crafted is how a real player would work through a
// multi-tier recipe too.
//
// Skips a recipe that already has a batch in flight rather than queuing
// another one on top of it - `ownedEquipmentCount`/`getMaterialQuantity`
// only reflect *delivered* quantity, so without this guard a party sitting
// on a surplus of raw materials would re-queue the same recipe on every
// subsequent call before the first batch ever finishes, filling the queue
// with duplicates of one recipe instead of leaving room for anything else
// (notably the capstone-gate craft, this pipeline's top priority).
function attemptCraftRecipeChain(
  tradeskill: Tradeskill,
  recipe: RecipeContent,
  quantity: number,
  visited: Set<RecipeId>,
  depth = 0,
): boolean {
  if (visited.has(recipe.id)) return false;
  visited.add(recipe.id);

  if (!isRecipeCraftable(recipe.id)) return false;
  if (tradeskillBuilding(tradeskill).level < recipe.minTradeskillLevel) return false;
  if (isRecipeAlreadyQueued(tradeskill, recipe.id)) return false;

  if (craftMaxCraftableQuantity(recipe, tradeskill) > 0) {
    return craftQueueStart(tradeskill, recipe.id, quantity);
  }

  if (depth >= MAX_PREREQ_CHAIN_DEPTH) return false;

  const shortRequirement = firstShortItemRequirement(recipe, quantity);
  if (!shortRequirement) return false; // blocked on an equipment/collectible req, not chainable

  const prereqRecipe = recipeProducingItem(tradeskill, shortRequirement.itemId);
  if (!prereqRecipe) return false;

  return attemptCraftRecipeChain(
    tradeskill,
    prereqRecipe,
    shortRequirement.quantity * quantity - getMaterialQuantity(shortRequirement.itemId),
    visited,
    depth + 1,
  );
}

function attemptCapstoneCraft(tradeskill: Tradeskill): boolean {
  const gate = tradeskillActiveGate(tradeskill);
  if (!gate) return false;

  const recipe = collectibleRecipeIndex().get(gate.requiredCollectibleId);
  if (!recipe || recipe.tradeskill !== tradeskill) return false;

  return attemptCraftRecipeChain(tradeskill, recipe, 1, new Set());
}

// Whether `jobId` can actually wear `equipment` - ignores the character-level
// gate `canEquipItem` (equipment.ts) checks, since crafting should get ahead
// of need rather than wait for a hero to reach the level requirement first.
function jobCanUseEquipment(jobId: JobId, equipment: EquipmentContent): boolean {
  const job = getEntry<JobContent>(jobId);
  if (!job || !job.equippableTypes.includes(equipment.type)) return false;

  return isSlotAvailableForJob(EquipmentTypeToSlot[equipment.type][0], jobId);
}

// How many current party members could actually wear this - naturally caps
// at party size, and is 0 for anything nobody in the party can use at all.
function partyEquipmentTargetQuantity(equipment: EquipmentContent): number {
  return partyGet().filter((character) => jobCanUseEquipment(character.jobId, equipment))
    .length;
}

function ownedEquipmentCount(equipmentId: EquipmentId): number {
  const armoryCount = armoryGet().filter((item) => item.equipmentId === equipmentId).length;
  const equippedCount = partyGet().reduce(
    (total, character) =>
      total +
      equippedItems(character.equipment).filter((item) => item.equipmentId === equipmentId)
        .length,
    0,
  );

  return armoryCount + equippedCount;
}

type EquipmentCraftTarget = {
  equipment: EquipmentContent;
  recipesByTradeskill: Map<Tradeskill, RecipeContent>;
};

// Equipment any current party member's job can use, each mapped to its best
// (highest-tier) recipe per producing tradeskill - rebuilt once per scenario
// (see `configureStrategyDecree`), since it depends on the party's jobs, not
// just static content.
let partyEquipmentTargets: EquipmentCraftTarget[] = [];

function rebuildPartyEquipmentTargets(): void {
  const index = equipmentRecipeIndex();

  partyEquipmentTargets = getEntriesByType<EquipmentContent>('equipment')
    .filter((equipment) => index.has(equipment.id) && partyEquipmentTargetQuantity(equipment) > 0)
    .map((equipment) => {
      const recipesByTradeskill = new Map<Tradeskill, RecipeContent>();

      (index.get(equipment.id) ?? []).forEach((recipe) => {
        const existing = recipesByTradeskill.get(recipe.tradeskill);
        if (!existing || recipe.minTradeskillLevel > existing.minTradeskillLevel) {
          recipesByTradeskill.set(recipe.tradeskill, recipe);
        }
      });

      return { equipment, recipesByTradeskill };
    });
}

// Walks `recipe`'s requirements, adding any that are directly gatherable to
// `found`, and recursing into whatever same-tradeskill recipe produces a
// non-gatherable requirement instead (mirrors `attemptCraftRecipeChain`'s
// traversal, but collects raw-material ids rather than queuing crafts).
function collectGatherableRequirementIds(
  recipe: RecipeContent,
  gatherable: Set<MaterialId>,
  found: Set<MaterialId>,
  visited: Set<RecipeId>,
  depth: number,
): void {
  if (visited.has(recipe.id) || depth > MAX_PREREQ_CHAIN_DEPTH) return;
  visited.add(recipe.id);

  recipe.requirements.forEach((requirement) => {
    if (!('itemId' in requirement)) return;

    if (gatherable.has(requirement.itemId)) {
      found.add(requirement.itemId);
      return;
    }

    const prereqRecipe = recipeProducingItem(recipe.tradeskill, requirement.itemId);
    if (prereqRecipe) {
      collectGatherableRequirementIds(prereqRecipe, gatherable, found, visited, depth + 1);
    }
  });
}

// Every material any GatherNode in the game can ever produce, regardless of
// whether it's been discovered yet or the party could currently gather
// there - static content, cached once for the process (same rationale as
// `equipmentRecipeIndex`/`collectibleRecipeIndex`). Deliberately *not* the
// game's own `gatherableMaterialIds()` helper, which is scoped to already-
// discovered nodes - this needs the full catalog to know what to eventually
// look for as gather clauses get added incrementally (see
// `syncGatherMaterialClauses`).
let allGatherableMaterialIdsCache: Set<MaterialId> | undefined;

function allGatherableMaterialIds(): Set<MaterialId> {
  if (!allGatherableMaterialIdsCache) {
    allGatherableMaterialIdsCache = new Set();
    worldNodesOfType('GatherNode').forEach((entry) => {
      worldNodeGatherMaterialIds(entry).forEach((id) =>
        allGatherableMaterialIdsCache!.add(id),
      );
    });
  }
  return allGatherableMaterialIdsCache;
}

// Raw materials the party's crafting pipeline will actually need - every
// party-relevant equipment recipe (`partyEquipmentTargets`) and every
// tradeskill's capstone-gate recipe (`collectibleRecipeIndex` - capstones
// apply per-tradeskill regardless of whether the party can use that
// tradeskill's equipment output, so they're searched separately), walked
// down through prerequisite chains to whichever requirements are themselves
// gatherable *somewhere* in the game. Rebuilt once per scenario alongside
// `partyEquipmentTargets` - `syncGatherMaterialClauses` re-checks this fixed
// list every tick against what's *currently* gatherable, since that changes
// as the party discovers nodes and levels up.
let partyRelevantMaterialIds: MaterialId[] = [];

function rebuildPartyRelevantMaterialIds(): void {
  const gatherable = allGatherableMaterialIds();
  const found = new Set<MaterialId>();
  const visited = new Set<RecipeId>();

  const recipesToSearch: RecipeContent[] = [
    ...partyEquipmentTargets.flatMap((target) => [...target.recipesByTradeskill.values()]),
    ...collectibleRecipeIndex().values(),
  ];

  recipesToSearch.forEach((recipe) =>
    collectGatherableRequirementIds(recipe, gatherable, found, visited, 0),
  );

  partyRelevantMaterialIds = [...found];
}

// Whether the party could gather `materialId` right now - a discovered
// GatherNode that produces it exists *and* the party's weakest hero meets
// that node's own level requirement. `gatheringStart` (gathering.ts) enforces
// this same level gate when actually starting a gather session, but
// `isClauseSatisfiable`'s `GatherMaterial` case (decree-evaluation.ts) does
// not - it only checks that a discovered node exists, not that the party can
// use it. Without this check, a `GatherMaterial` clause targeting a node the
// party is too low-level for would look "satisfiable" forever: Auto Mode
// travels there, `gatheringStart` silently no-ops (wrong level), the party
// looks idle again next tick, and it repeats - an infinite arrive-fail-retry
// loop that burns the entire run without making progress. Explicitly gating
// clause *creation* on level here keeps that failure mode from ever starting
// (verified against gamedata: hidden GatherNodes in particular can be
// pre-discovered by `discoverHiddenNodesForSimulation` well above the
// party's actual level).
function isMaterialCurrentlyGatherable(materialId: MaterialId): boolean {
  const partyLevel = partyMinLevel();

  return worldNodesOfType('GatherNode').some((entry) => {
    if (!isGatherNodeDiscovered(entry.nodeName) || !isWorldNodeVisible(entry)) {
      return false;
    }

    const gathering = worldNodeGathering(entry);
    return (
      !!gathering &&
      partyLevel >= gathering.levelRange.min &&
      worldNodeGatherMaterialIds(entry).includes(materialId)
    );
  });
}

// `decreeClauseAdd` always appends to the end of the priority list, but
// `configureStrategyDecree` already put `ReturnToKingdom` there - a clause
// added after it would sit behind a near-always-satisfiable fallback and
// effectively never run. Reorder it to the very front (highest priority)
// instead, but only on a genuine first add - `decreeClauseAdd` returns
// `false` for a clause that already exists (same material), which already
// has whatever position it was first given.
function addGatherMaterialClauseWithPriority(materialId: MaterialId): void {
  const added = decreeClauseAdd({
    type: 'GatherMaterial',
    materialId,
    targetQuantity: GATHER_MATERIAL_TARGET_QUANTITY,
  });
  if (!added) return;

  decreeClauseReorder(decreeClauses().length - 1, 0);
}

// Adds a `GatherMaterial` clause for each of the party's relevant materials
// the moment it actually becomes gatherable (discovered node + party level),
// rather than deciding once at scenario start - the party's level changes
// throughout the run, so what's viable does too. No-ops entirely once the
// scenario's gather time budget is exhausted (see `enforceGatherTimeBudget`)
// - no point adding more clauses that would just get disabled again anyway.
function syncGatherMaterialClauses(): void {
  if (gatherTimeBudgetExhausted) return;

  partyRelevantMaterialIds.forEach((materialId) => {
    if (isMaterialCurrentlyGatherable(materialId)) {
      addGatherMaterialClauseWithPriority(materialId);
    }
  });
}

// `GATHER_MATERIAL_TARGET_QUANTITY` bounds one clause by *quantity*, but two
// things make that insufficient on its own (both confirmed via live runs):
//
// 1. A rare drop (e.g. a gather node's 1%-chance material) could take tens
//    of thousands of ticks to reach the same target a common one clears in
//    a few hundred - `GATHER_TIMEOUT_TICKS` bounds any *one* clause's worst
//    case by force-disabling + interrupting it if it stays active that long
//    (disabling alone doesn't interrupt an in-progress session -
//    `stopGatherIfTargetReached`/`isPartyIdleForAutoMode` in auto-mode.ts
//    never check `clause.enabled`, only target-quantity and idle-state, and
//    gathering has no other stop condition - so `gatheringStop()` is what
//    actually hands control back to Auto Mode on the next tick).
// 2. Multiple materials rotating through that same per-clause bound can
//    still dominate the *entire* run: crafting resumes the moment gathering
//    pauses (between nodes, between clause switches) and can drag an
//    already-hit target back under threshold before the party fully
//    disengages, so with several materials in play some clause is almost
//    always unsatisfied and `LevelUpParty` never wins (observed directly: a
//    party bounced between 3 gather nodes for a full 20,000-tick test
//    without ever leveling past 4). `GATHER_TIME_BUDGET_FRACTION` bounds
//    this: once the party has spent that fraction of the *whole scenario*
//    with any `GatherMaterial` clause active, every one of them is disabled
//    for the rest of the run.
let timedGatherClauseId: DecreeClauseId | undefined;
let timedGatherClauseSinceTick: number | undefined;
let cumulativeGatherTicks = 0;
let gatherTimeBudgetExhausted = false;

function resetGatherTimeTracking(): void {
  timedGatherClauseId = undefined;
  timedGatherClauseSinceTick = undefined;
  cumulativeGatherTicks = 0;
  gatherTimeBudgetExhausted = false;
}

// Whether the party has already spent its whole `GATHER_TIME_BUDGET_FRACTION`
// allowance actively gathering this scenario - see `checkSupplyStall` in
// driver.ts, which uses this in place of the real game's own
// `gatherableMaterialIds()` (`@helpers/world-node-gathering`) to detect a
// genuine supply-chain dead end. That helper is gated on discovery, but
// every GatherNode is pre-discovered for this simulator from tick 1 (see
// `discoverAllGatherNodesForSimulation` in run.ts) - so `gatherableMaterialIds`
// is never empty here, and a stall check built on it would never fire. "We
// actively tried to gather, ran out of budget, and still can't craft" is a
// more precise signal of an actual dead end anyway.
export function isGatherTimeBudgetExhausted(): boolean {
  return gatherTimeBudgetExhausted;
}

function disableAllGatherMaterialClauses(): void {
  decreeClauses()
    .filter((clause) => clause.type === 'GatherMaterial')
    .forEach((clause) => decreeClauseSetEnabled(clause.id, false));

  gatheringStop();
}

function enforceGatherTimeBudget(tick: number, tickBudget: number): void {
  if (gatherTimeBudgetExhausted) return;

  const activeClauseId = gamestate().world.autoMode.activeClauseId;
  const activeClause = decreeClauses().find((clause) => clause.id === activeClauseId);

  if (!activeClause || activeClause.type !== 'GatherMaterial') {
    timedGatherClauseId = undefined;
    timedGatherClauseSinceTick = undefined;
    return;
  }

  cumulativeGatherTicks += 1;
  if (cumulativeGatherTicks >= tickBudget * GATHER_TIME_BUDGET_FRACTION) {
    gatherTimeBudgetExhausted = true;
    disableAllGatherMaterialClauses();
    timedGatherClauseId = undefined;
    timedGatherClauseSinceTick = undefined;
    return;
  }

  if (timedGatherClauseId !== activeClause.id) {
    timedGatherClauseId = activeClause.id;
    timedGatherClauseSinceTick = tick;
    return;
  }

  if (tick - timedGatherClauseSinceTick! >= GATHER_TIMEOUT_TICKS) {
    decreeClauseSetEnabled(activeClause.id, false);
    gatheringStop();
    timedGatherClauseId = undefined;
    timedGatherClauseSinceTick = undefined;
  }
}

function attemptPartyEquipmentCraft(tradeskill: Tradeskill): boolean {
  for (const target of partyEquipmentTargets) {
    const recipe = target.recipesByTradeskill.get(tradeskill);
    if (!recipe) continue;

    const targetQuantity = partyEquipmentTargetQuantity(target.equipment);
    const owned = ownedEquipmentCount(target.equipment.id);
    if (owned >= targetQuantity) continue;

    if (attemptCraftRecipeChain(tradeskill, recipe, targetQuantity - owned, new Set())) {
      return true;
    }
  }

  return false;
}

// Queues the single best currently-craftable recipe for every tradeskill
// that the targeted passes above (capstone, party-relevant equipment)
// didn't already act on this call - `getCraftableRecipeEntries` sorts
// craftable entries highest-level-first, so `[0]` is "the best thing
// craftable right now". Keeps a tradeskill from sitting idle when nothing
// targeted is actionable but *something* still is ("even a random crafted
// item would be better").
export function attemptTargetedCrafting(): CraftAttemptResult {
  const result: CraftAttemptResult = { anyRecipeUnlocked: false, anyQueued: false };

  ALL_TRADESKILLS.forEach((tradeskill) => {
    if (attemptCapstoneCraft(tradeskill) || attemptPartyEquipmentCraft(tradeskill)) {
      result.anyRecipeUnlocked = true;
      result.anyQueued = true;
      return;
    }

    const entries = getCraftableRecipeEntries(tradeskill);
    const best = entries[0];
    if (!best) return;

    result.anyRecipeUnlocked = true;
    if (best.maxCraftable <= 0) return;

    if (craftQueueStart(tradeskill, best.recipe.id, best.maxCraftable)) {
      result.anyQueued = true;
    }
  });

  return result;
}

// --- infusion / equipment reoptimization (unchanged from before) ---

// Infuses the first equipped-item/slot/material combination that's valid
// and affordable. One infusion per call is intentional - this runs on a
// tick interval, so the strategy catches up gradually rather than trying to
// infuse every open slot in a single tick.
function attemptInfusion(): void {
  const materialIds = Object.keys(gamestate().materials) as MaterialId[];
  const infusionMaterialIds = materialIds.filter((id) => {
    const item = getEntry<ItemContent>(id);
    return item && isInfusionMaterial(item);
  });
  if (infusionMaterialIds.length === 0) return;

  for (const character of partyGet()) {
    for (const slot of Object.keys(character.equipment) as EquipmentSlot[]) {
      const item = character.equipment[slot];
      if (!item) continue;

      for (let slotIndex = 0; slotIndex < item.infusedItemIds.length; slotIndex++) {
        const materialId = infusionMaterialIds.find((id) =>
          canInfuseEquipmentItem(item, slotIndex, id as ItemId),
        );
        if (!materialId) continue;

        characterInfuseEquipment(
          character.id,
          item.id,
          slotIndex,
          materialId as ItemId,
        );
        return;
      }
    }
  }
}

// Equips the best owned item per slot for every party member, only where it
// beats what's already equipped (`optimizeCharacterEquipment` is a no-op per
// slot if nothing in the armory is an upgrade). Exported for driver.ts to
// call whenever new equipment is acquired - see `runScenario`'s
// armory-diff check.
export function reoptimizeAllEquipment(): void {
  partyGet().forEach((character) => optimizeCharacterEquipment(character.id));
}

// Called every tick by the driver - internally no-ops except on each
// strategy's configured cadence, so cheap to call unconditionally.
export function applyStrategyPolicy(
  strategy: StrategyName,
  tick: number,
  tickBudget: number,
): CraftAttemptResult | null {
  const preset = STRATEGY_PRESETS[strategy];

  syncGatherMaterialClauses();
  enforceGatherTimeBudget(tick, tickBudget);

  let craftResult: CraftAttemptResult | null = null;

  // Both paused while the party is actively gathering - crafting/infusion
  // would otherwise consume the very material a `GatherMaterial` clause is
  // trying to stockpile as fast as it's produced, so the clause's target
  // quantity (`GATHER_MATERIAL_TARGET_QUANTITY`) never durably clears and
  // the party never leaves the gather node to resume leveling (confirmed
  // via live runs for both paths: `always-craft` got stuck gathering/
  // crafting Wergen Wood/Wooden Arrow in a steady-state loop at one node,
  // and separately, infusion alone can drain a rare capstone-required
  // material like Malachite the same way). Letting the stockpile build up
  // uncontested lets the target actually get hit, which is what hands
  // control back to Auto Mode (`stopGatherIfTargetReached` in auto-mode.ts)
  // and lets the standing clause priority (`configureStrategyDecree`) move
  // on to `LevelUpParty`.
  const gatheringNow = isGathering();

  if (!gatheringNow && tick % preset.craftIntervalTicks === 0) {
    craftResult = attemptTargetedCrafting();
  }

  if (!gatheringNow && tick % preset.infuseIntervalTicks === 0) {
    attemptInfusion();
  }

  return craftResult;
}
