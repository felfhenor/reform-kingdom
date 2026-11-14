import { environment } from '@environments/environment';
import { getEntry } from '@helpers/content/content';
import { isOutpostBuilt } from '@helpers/world-node/world-node-outpost';
import { worldNodeShrineLevel } from '@helpers/world-node/world-node-shrine';
import {
  worldNodeCaravan,
  worldNodeCollectibleGate,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeExchange,
  worldNodeGathering,
  worldNodeOutpost,
  worldNodeOverride,
  worldNodeShrine,
  worldNodeTown,
  worldNodeTrainer,
} from '@helpers/world-node/world-nodes';
import type {
  Combat,
  EncounterContent,
  EncounterRandomContent,
  HasNodeBackground,
  NodeBackground,
  TownContent,
  WorldNodeEntry,
} from '@interfaces';
import { NODE_BACKGROUNDS } from '@interfaces';

// Production ships the webps built by `npm run build:nodebg`.
export function nodeBackgroundURL(background: NodeBackground): string {
  return environment.production
    ? `art/nodebg/${background}.webp`
    : `asset/nodebg/${background}.png`;
}

export function nodeBackgroundURLs(): string[] {
  return NODE_BACKGROUNDS.map(nodeBackgroundURL);
}

export function combatNodeBackground(
  combat: Combat,
): HasNodeBackground | undefined {
  return (
    getEntry<EncounterContent>(combat.encounterId ?? '') ??
    getEntry<EncounterRandomContent>(combat.encounterRandomId ?? '') ??
    getEntry<TownContent>(combat.raidTownId ?? '')
  );
}

// An unbuilt outpost or shrine shows faded, so building it visibly restores the place.
function isWorldNodeUnbuilt(entry: WorldNodeEntry): boolean {
  if (worldNodeOutpost(entry)) return !isOutpostBuilt(entry.nodeName);
  if (worldNodeShrine(entry)) return worldNodeShrineLevel(entry.nodeName) < 1;
  return false;
}

export function worldNodeBackground(
  entry: WorldNodeEntry,
): HasNodeBackground | undefined {
  const content =
    worldNodeOverride(entry) ??
    worldNodeEncounter(entry) ??
    worldNodeEncounterRandom(entry) ??
    worldNodeGathering(entry) ??
    worldNodeExchange(entry) ??
    worldNodeTown(entry) ??
    worldNodeCaravan(entry) ??
    worldNodeShrine(entry) ??
    worldNodeOutpost(entry) ??
    worldNodeTrainer(entry) ??
    worldNodeCollectibleGate(entry);
  if (!content) return undefined;

  return isWorldNodeUnbuilt(entry)
    ? { background: content.background, backgroundFilter: 'Faded' }
    : content;
}
