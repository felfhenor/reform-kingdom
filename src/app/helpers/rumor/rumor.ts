import { getEntriesByType, getEntry } from '@helpers/content/content';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { regionForMap } from '@helpers/lore/region-intro';
import { rngChoice } from '@helpers/rng';
import { worldPartyState } from '@helpers/state-game';
import { characterAllTeachingIds } from '@helpers/trainer/trainer-teaching';
import { isWorldMapVisited } from '@helpers/world-node/world-map-discovery';
import {
  isWorldNodeVisible,
  worldNodeByName,
} from '@helpers/world-node/world-nodes';
import type {
  ItemContent,
  RumorContent,
  RumorId,
  RumorSubject,
} from '@interfaces';

const RUMOR_ITEM_NAME = 'Rumor';

export function rumorSprite(): string | undefined {
  return getEntry<ItemContent>(RUMOR_ITEM_NAME)?.sprite;
}

// Visible covers both ways a node stays secret: hidden until clicked, or gated behind collectibles.
export function isRumorSubjectFound(subject: RumorSubject): boolean {
  switch (subject.kind) {
    case 'Node': {
      const entry = worldNodeByName(subject.nodeName);
      return entry ? isWorldNodeVisible(entry) : false;
    }
    case 'Collectible':
      return isCollectibleDiscovered(subject.collectibleId);
    case 'TrainerTeaching':
      return worldPartyState().some((character) =>
        characterAllTeachingIds(character).includes(subject.trainerTeachingId),
      );
  }
}

export function isRumorHearable(rumor: RumorContent): boolean {
  if (isRumorSubjectFound(rumor.subject)) return false;
  return (
    rumor.requireMapVisit === '' || isWorldMapVisited(rumor.requireMapVisit)
  );
}

export function rumorsHearable(): RumorContent[] {
  return getEntriesByType<RumorContent>('rumor').filter(isRumorHearable);
}

export function rumorPickHearable(): RumorContent | undefined {
  const rumors = rumorsHearable();
  return rumors.length === 0 ? undefined : rngChoice(rumors);
}

// Only a Node rumor can be sold as a reveal; anything else has no node to mark.
export function rumorRevealNodeName(rumorId: RumorId): string | undefined {
  const rumor = getEntry<RumorContent>(rumorId);
  return rumor?.subject.kind === 'Node' ? rumor.subject.nodeName : undefined;
}

// A missing rumor counts as revealed so a stale trade can never be bought.
export function isRumorRevealed(rumorId: RumorId): boolean {
  const rumor = getEntry<RumorContent>(rumorId);
  return rumor ? isRumorSubjectFound(rumor.subject) : true;
}

// Sold rumors only say where to look; the hint itself is saved for the Founder's whispers.
export function rumorTeaser(rumor: RumorContent): string {
  const region = regionForMap(rumor.requireMapVisit);
  return region
    ? `Word of something hidden in ${region.name}.`
    : 'Word of something hidden.';
}
