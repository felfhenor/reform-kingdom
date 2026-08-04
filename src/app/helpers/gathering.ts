import { getEntry } from '@helpers/content';
import { gatherMessageLog, itemDropHtml } from '@helpers/combat-log';
import { defaultGatheringState } from '@helpers/defaults';
import { addMaterial } from '@helpers/materials';
import { partyGainXp, partyGet } from '@helpers/party';
import { rngChoiceWeighted } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeByName, worldNodeGathering } from '@helpers/world-nodes';
import type {
  GatherResult,
  GatheringContent,
  ItemContent,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function partyMinLevel(): number {
  const party = partyGet();
  if (party.length === 0) return 1;

  return Math.min(...party.map((character) => character.level));
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

function grantGatherItems(result: GatherResult, nodeName: string): void {
  const descriptions = result.items
    .filter(({ quantity }) => quantity > 0)
    .map(({ itemId, quantity }) => {
      addMaterial(itemId, quantity);

      const item = getEntry<ItemContent>(itemId);
      if (!item) return undefined;

      return itemDropHtml(item, quantity);
    })
    .filter((description): description is string => !!description);

  if (descriptions.length === 0) return;

  gatherMessageLog(nodeName, `The party found ${descriptions.join(', ')}!`);
}

function resolveGatherCycle(content: GatheringContent, nodeName: string): void {
  grantGatherXpIfInRange(content);

  const result = gatheringRollResult(content);
  if (result) grantGatherItems(result, nodeName);

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
