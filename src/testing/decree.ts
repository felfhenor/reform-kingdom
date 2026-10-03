import '@/testing/reset';
import {
  ensureEncounter,
  ensureEncounterRandom,
} from '@helpers/content/ensure-encounternode';
import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureTown } from '@helpers/content/ensure-town';
import { decreeRouteTo } from '@helpers/decree/decree-route';
import { applyMaterialDelta } from '@helpers/item/materials';
import type {
  CollectibleId,
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
  EncounterContent,
  EncounterId,
  EncounterRandomContent,
  EncounterRandomId,
  GameState,
  GatheringContent,
  GatheringId,
  IsContentItem,
  ItemId,
  TownContent,
  TownContentInput,
  TownId,
  WorldNodeEntry,
  WorldNodeType,
} from '@interfaces';
import { beforeEach, vi } from 'vitest';
import { buildCharacter, buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

type StateEdit = (state: GameState) => void;

const unfinishedRewards = [
  ensureDroppedReward({ collectibleId: 'lotus' as CollectibleId, chance: 1 }),
];

// Every node starts with a reward still to find, so it counts as an unfinished area.
export function explore(
  name: string,
  min: number,
  max = min,
  overrides: Partial<EncounterContent> = {},
): EncounterContent {
  return ensureEncounter({
    id: name as EncounterId,
    name,
    levelRange: { min, max },
    completionRewards: unfinishedRewards,
    ...overrides,
  });
}

export function mystical(
  name: string,
  min: number,
  overrides: Partial<EncounterRandomContent> = {},
): EncounterRandomContent {
  return ensureEncounterRandom({
    id: name as EncounterRandomId,
    name,
    levelRange: { min, max: min },
    completionRewards: unfinishedRewards,
    ...overrides,
  });
}

export function grove(
  name: string,
  itemIds: ItemId[],
  overrides: Partial<GatheringContent> = {},
): GatheringContent {
  return ensureGathering({
    id: name as GatheringId,
    name,
    gatherResults: itemIds.map((itemId) =>
      ensureGatherResult({ chance: 1, items: [{ itemId, quantity: 1 }] }),
    ),
    ...overrides,
  });
}

// Distinct from the name, so code that confuses the two fails.
export function townIdOf(name: string): TownId {
  return name.toLowerCase() as TownId;
}

export function town(
  name: string,
  min: number,
  max = min,
  overrides: TownContentInput = {},
): TownContent {
  return ensureTown({
    id: townIdOf(name),
    name,
    defense: { assaulter: { level: { min, max } } },
    ...overrides,
  });
}

const nodeTypeOf: Record<string, WorldNodeType> = {
  encounter: 'ExploreNode',
  encounterrandom: 'ExploreRandomNode',
  gathering: 'GatherNode',
  town: 'NonPlayerKingdom',
};

// Stands in for pathfinding (which has its own spec): a place is reachable in `steps`, optionally only by stopping at `via` first.
const routes = new Map<string, { steps: number; via?: string }>();
let seededNodes: Record<string, WorldNodeEntry> = {};

// Call at the top of a spec that has `vi.mock('@helpers/decree/decree-route')`.
export function useStubDecreeRoutes(): void {
  beforeEach(() => {
    routes.clear();
    seededNodes = {};
    vi.mocked(decreeRouteTo).mockImplementation((target, canStopAt) => {
      const route = routes.get(target.nodeName);
      if (!route) return undefined;
      if (!route.via) return { hop: target, steps: route.steps };

      const gateway = seededNodes[route.via];
      return gateway && canStopAt(gateway)
        ? { hop: gateway, steps: route.steps }
        : undefined;
    });
  });
}

export function setDecreeRoute(nodeName: string, steps?: number): void {
  if (steps === undefined) routes.delete(nodeName);
  else routes.set(nodeName, { steps });
}

// A place without `steps` is unreachable. Gather nodes start discovered and the party is one level-10 hero.
export function seedDecreeWorld(
  places: {
    content?:
      | EncounterContent
      | EncounterRandomContent
      | GatheringContent
      | TownContent;
    name?: string;
    type?: WorldNodeType;
    steps?: number;
    via?: string;
  }[],
  edit?: StateEdit,
  extraContent: IsContentItem[] = [],
): Record<string, WorldNodeEntry> {
  const named = places.map((place) => ({
    ...place,
    name: place.name ?? place.content!.name,
  }));
  seedContent([
    ...named.flatMap((place) => (place.content ? [place.content] : [])),
    ...extraContent,
  ]);
  seededNodes = seedWorldNodes(
    named.map((place) => ({
      name: place.name,
      type: place.type ?? nodeTypeOf[place.content!.__type],
    })),
  );
  routes.clear();
  named.forEach(({ name, steps, via }) => {
    if (steps !== undefined) routes.set(name, { steps, via });
  });
  seedGamestate((state) => {
    state.world.party = [buildCharacter({ level: 10 })];
    named
      .filter((place) => place.content?.__type === 'gathering')
      .forEach(
        ({ name }) => (state.discoveredGatherNodes[name] = { foundAt: 1 }),
      );
    edit?.(state);
  });
  return seededNodes;
}

export function decreeClause<T extends DecreeClauseAction>(
  action: T,
  overrides: Partial<Pick<DecreeClause, 'id' | 'enabled'>> = {},
): T & Pick<DecreeClause, 'id' | 'enabled' | 'failureCount'> {
  return {
    id: 'clause' as DecreeClauseId,
    enabled: true,
    failureCount: 0,
    ...action,
    ...overrides,
  };
}

export function standingAt(nodeName: string): StateEdit {
  return (state) =>
    (state.world.currentLocation = locationOf(seededNodes[nodeName]));
}

export function withEdits(...edits: StateEdit[]): StateEdit {
  return (state) => edits.forEach((edit) => edit(state));
}

export function partyAt(...levels: number[]): StateEdit {
  return (state) =>
    (state.world.party = levels.map((level) => buildCharacter({ level })));
}

export function hurtAndWaiting(state: GameState): void {
  state.world.party.forEach((hero) => (hero.hp = 0));
  state.world.autoMode.waitForFullHealthBeforeCombat = true;
}

export function stocked(itemId: ItemId, quantity: number): StateEdit {
  return (state) => applyMaterialDelta(state, itemId, quantity);
}

export function nodeFailures(counts: Record<string, number>): StateEdit {
  return (state) => (state.world.autoMode.nodeFailureCounts = counts);
}

export function mysticalUp(
  name: string,
  completedThisCycle = false,
): StateEdit {
  return (state) =>
    (state.world.exploreRandom[name as EncounterRandomId] = {
      fights: [{ level: 1, monsters: [] }],
      generatedAtTick: 0,
      completedThisCycle,
    });
}

export function raidOn(...townNames: string[]): StateEdit {
  return (state) =>
    townNames.forEach(
      (name) =>
        (state.world.towns[townIdOf(name)] = buildTownNodeState({
          raidTelegraphedAtTick: 1,
          raidEngageWindowExpiresAtTick: 100,
        })),
    );
}
