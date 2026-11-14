import { environment } from '@environments/environment';
import { getEntry } from '@helpers/content/content';
import {
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeExchange,
  worldNodeGathering,
  worldNodeTown,
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

export function worldNodeBackground(
  entry: WorldNodeEntry,
): HasNodeBackground | undefined {
  return (
    worldNodeEncounter(entry) ??
    worldNodeEncounterRandom(entry) ??
    worldNodeGathering(entry) ??
    worldNodeExchange(entry) ??
    worldNodeTown(entry)
  );
}
