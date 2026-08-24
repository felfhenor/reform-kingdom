import { partyGainXp } from '@helpers/character-progress';
import { gatherMessageLog, itemDropHtml } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { defaultGatheringState } from '@helpers/defaults';
import { luckRollSucceeds, partyMaxLuck } from '@helpers/luck';
import { rollDroppedRewards } from '@helpers/loot';
import { addMaterial } from '@helpers/materials';
import { partyGet } from '@helpers/party';
import { researchPointItemId } from '@helpers/research/research';
import { researchGatherBonusQuantityChance } from '@helpers/research/research-effects';
import { rngChoiceWeighted, rngSucceedsChance } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  isFirstTimeNodeRewardsGranted,
  markFirstTimeNodeRewardsGranted,
} from '@helpers/world-node-first-time-rewards';
import { worldNodeByName, worldNodeGathering } from '@helpers/world-nodes';
import type {
  GatherResult,
  GatheringContent,
  ItemContent,
  ResolvedItemDrop,
} from '@interfaces';
import { clamp, sumBy } from 'es-toolkit/compat';

export function partyMinLevel(): number {
  const party = partyGet();
  if (party.length === 0) return 1;

  return Math.min(...party.map((character) => character.level));
}

// Strongest hero represents the party for over-level XP scaling, same convention as combat-end.ts's partyRepresentativeLevel.
export function partyMaxLevel(): number {
  const party = partyGet();
  if (party.length === 0) return 1;

  return Math.max(...party.map((character) => character.level));
}

export function canEnterGatherNode(nodeName: string): boolean {
  const node = worldNodeByName(nodeName);
  if (!node) return true;

  const gathering = worldNodeGathering(node);
  if (!gathering) return true;

  return partyMinLevel() >= gathering.levelRange.min;
}

export function isGathering(): boolean {
  return gamestate().world.gathering.status === 'Gathering';
}

export function currentGatheringContent(): GatheringContent | undefined {
  const gatheringId = gamestate().world.gathering.gatheringId;
  if (!gatheringId) return undefined;

  return getEntry<GatheringContent>(gatheringId);
}

export function gatheringProgressFraction(): number {
  const gathering = gamestate().world.gathering;
  if (gathering.status !== 'Gathering') return 0;

  const content = currentGatheringContent();
  if (!content || content.gatherTime <= 0) return 0;

  return clamp(gathering.ticksIntoGather / content.gatherTime, 0, 1);
}

export function gatheringRollResult(
  gathering: GatheringContent,
): GatherResult | undefined {
  return rngChoiceWeighted(gathering.gatherResults, (result) => result.chance);
}

export function gatheringStart(nodeName: string): boolean {
  const node = worldNodeByName(nodeName);
  if (!node) return false;

  const gathering = worldNodeGathering(node);
  if (!gathering) return false;

  if (partyMinLevel() < gathering.levelRange.min) return false;

  updateGamestate((state) => {
    state.world.gathering = {
      status: 'Gathering',
      nodeName,
      gatheringId: gathering.id,
      ticksIntoGather: 0,
    };
    return state;
  });

  gatherMessageLog(nodeName, `The party begins gathering at ${nodeName}.`);

  return true;
}

export function gatheringStop(): void {
  updateGamestate((state) => {
    state.world.gathering = defaultGatheringState();
    return state;
  });
}

function grantGatherXpIfInRange(content: GatheringContent): void {
  if (content.xpGainedIfInLevelRange <= 0) return;

  const level = partyMinLevel();
  if (level < content.levelRange.min || level > content.levelRange.max) return;

  partyGainXp(content.xpGainedIfInLevelRange);
}

function grantGatherItems(
  result: GatherResult,
  nodeName: string,
  yieldMultiplier: number,
  bonusQuantity: number,
): void {
  const descriptions = result.items
    .filter(({ quantity }) => quantity > 0)
    // Research bonusQuantity is a once-per-cycle extra, not per item type -
    // applying it to every item in a multi-item result (e.g. a gather node
    // that yields both wood and a stick on one roll) would over-grant it
    // once per item, so it only ever lands on the first granted item.
    .map(({ itemId, quantity }, index) => {
      const grantedQuantity =
        quantity * yieldMultiplier + (index === 0 ? bonusQuantity : 0);
      addMaterial(itemId, grantedQuantity);

      const item = getEntry<ItemContent>(itemId);
      if (!item) return undefined;

      return itemDropHtml(item, grantedQuantity);
    })
    .filter((description): description is string => !!description);

  if (descriptions.length === 0) return;

  gatherMessageLog(nodeName, `The party found ${descriptions.join(', ')}!`);
}

// Fires once per physical node, ever - see world-node-first-time-rewards.ts.
// Gathering has no combat context to hand rollDroppedRewards's resolved
// drops to, so this reuses addMaterial/gatherMessageLog directly, same as
// grantGatherItems does for the node's regular gatherResults.
function grantGatherFirstTimeRewards(
  content: GatheringContent,
  nodeName: string,
): void {
  if (!content.firstTimeRewards?.length) return;
  if (isFirstTimeNodeRewardsGranted(nodeName)) return;

  const drops = rollDroppedRewards(content.firstTimeRewards, partyMaxLevel());
  const itemDrops = drops.filter(
    (drop): drop is ResolvedItemDrop => 'itemId' in drop,
  );

  itemDrops.forEach(({ itemId, quantity }) => addMaterial(itemId, quantity));

  const rpItemId = researchPointItemId();
  const rpGranted = sumBy(
    itemDrops.filter((drop) => drop.itemId === rpItemId),
    (drop) => drop.quantity,
  );
  markFirstTimeNodeRewardsGranted(nodeName, rpGranted);
}

function resolveGatherCycle(content: GatheringContent, nodeName: string): void {
  grantGatherXpIfInRange(content);

  const result = gatheringRollResult(content);
  if (result) {
    const yieldMultiplier = luckRollSucceeds(partyMaxLuck()) ? 2 : 1;
    const { chance, bonusQuantity } = researchGatherBonusQuantityChance();
    const researchBonus =
      chance > 0 && rngSucceedsChance(chance) ? bonusQuantity : 0;
    grantGatherItems(result, nodeName, yieldMultiplier, researchBonus);
  }

  grantGatherFirstTimeRewards(content, nodeName);

  updateGamestate((state) => {
    state.world.gathering.ticksIntoGather = 0;
    return state;
  });
}

export function gatheringProcessTick(): void {
  const gathering = gamestate().world.gathering;
  if (gathering.status !== 'Gathering' || !gathering.nodeName) return;

  const content = currentGatheringContent();
  if (!content) return;

  const ticksIntoGather = gathering.ticksIntoGather + 1;

  if (ticksIntoGather < content.gatherTime) {
    updateGamestate((state) => {
      state.world.gathering.ticksIntoGather = ticksIntoGather;
      return state;
    });
    return;
  }

  resolveGatherCycle(content, gathering.nodeName);
}
