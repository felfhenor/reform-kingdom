import {
  ACHIEVEMENT_JOB_MASTERY_LEVEL,
  CHARACTER_MAX_LEVEL,
  TRADESKILL_MAX_LEVEL,
} from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import { ledgerHas } from '@helpers/engine/ledger';
import { characterJobLevel } from '@helpers/hero/job';
import { isEquipmentDiscovered } from '@helpers/kingdom/armory';
import {
  bestiaryAnalyzedCount,
  bestiaryMonsters,
} from '@helpers/kingdom/bestiary';
import {
  remembranceCategories,
  remembranceTasks,
  remembranceWorkers,
} from '@helpers/remembrance/remembrance';
import {
  bestiaryState,
  collectiblesState,
  discoveredEquipmentState,
  discoveredMapsState,
  discoveredMaterialsState,
  discoveredWorkersState,
  gatherNodeLevelsState,
  outpostsState,
  runStatsState,
  shrinesState,
  tasksState,
  tradeskillsState,
  worldPartyState,
} from '@helpers/state-game';
import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import { worldNodeDevelopmentIsMaxLevel } from '@helpers/world-node/world-node-development';
import type {
  AchievementCounter,
  AchievementProgress,
  EquipmentContent,
  JobContent,
  OutpostContent,
  RegionContent,
  ShrineContent,
  TownContent,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

function countOf<T>(
  entries: T[],
  isDone: (entry: T) => boolean,
): AchievementProgress {
  return { current: entries.filter(isDone).length, max: entries.length };
}

function regions(): RegionContent[] {
  return getEntriesByType<RegionContent>('region');
}

function townsAtTier(tier: number): AchievementProgress {
  return countOf(
    getEntriesByType<TownContent>('town'),
    (town) => townReputationTier(town.id) >= tier,
  );
}

function partyLevel(): AchievementProgress {
  const levels = worldPartyState().map((hero) => hero.level);
  return {
    current: levels.length === 0 ? 0 : Math.min(...levels),
    max: CHARACTER_MAX_LEVEL,
  };
}

function mysticalFound(): AchievementProgress {
  return countOf(
    getEntriesByType<EquipmentContent>('equipment').filter(
      (equipment) =>
        RARITY_PRIORITY[equipment.rarity] >= RARITY_PRIORITY.Mystical,
    ),
    (equipment) => isEquipmentDiscovered(equipment.id),
  );
}

function tradeskillLevel(): AchievementProgress {
  const levels = Object.values(tradeskillsState()).map((skill) => skill.level);
  return { current: Math.max(0, ...levels), max: TRADESKILL_MAX_LEVEL };
}

// The best single hero, since one hero has to master them all.
function jobsMastered(): AchievementProgress {
  const jobs = getEntriesByType<JobContent>('job');
  const mastered = worldPartyState().map(
    (hero) =>
      jobs.filter(
        (job) =>
          characterJobLevel(hero, job.id) >= ACHIEVEMENT_JOB_MASTERY_LEVEL,
      ).length,
  );
  return { current: Math.max(0, ...mastered), max: jobs.length };
}

function remembrance(): AchievementProgress {
  const categories = remembranceCategories();
  return {
    current: sumBy(categories, (category) => category.current),
    max: sumBy(categories, (category) => category.max),
  };
}

const ACHIEVEMENT_COUNTERS: Record<
  AchievementCounter,
  () => AchievementProgress
> = {
  PartyLevel: partyLevel,
  RegionsVisited: () =>
    countOf(regions(), (region) =>
      ledgerHas(discoveredMapsState(), region.mapName),
    ),
  RegionsSealed: () =>
    countOf(
      regions(),
      (region) => runStatsState().seals[region.id] !== undefined,
    ),
  WorkersRescued: remembranceWorkers,
  TownsHonored: () => townsAtTier(2),
  TownsRenowned: () => townsAtTier(4),
  MonstersAnalyzed: () => ({
    current: bestiaryAnalyzedCount(bestiaryState()),
    max: bestiaryMonsters().length,
  }),
  MysticalFound: mysticalFound,
  ShrinesMaxed: () =>
    countOf(getEntriesByType<ShrineContent>('shrine'), (shrine) =>
      worldNodeDevelopmentIsMaxLevel(
        shrine,
        shrinesState()[shrine.name]?.level ?? 0,
      ),
    ),
  OutpostsBuilt: () =>
    countOf(
      getEntriesByType<OutpostContent>('outpost'),
      (outpost) => (outpostsState()[outpost.name]?.level ?? 0) > 0,
    ),
  TradeskillLevel: tradeskillLevel,
  TasksCompleted: remembranceTasks,
  Remembrance: remembrance,
  JobsMastered: jobsMastered,
};

// Cheap values standing in for slices that change far more often than the counters reading them.
const partyLowestLevel = () => partyLevel().current;
const sealCount = () => Object.keys(runStatsState().seals).length;
const townTiers = () =>
  getEntriesByType<TownContent>('town')
    .map((town) => townReputationTier(town.id))
    .join();
const monstersDiscovered = () => Object.keys(bestiaryState()).length;
const monstersAnalyzed = () => bestiaryAnalyzedCount(bestiaryState());
const tradeskillTopLevel = () => tradeskillLevel().current;
const jobsMasteredCount = () => jobsMastered().current;
const tasksCompleted = () =>
  Object.values(tasksState()).filter((task) => task.completedAt !== undefined)
    .length;

export function achievementCollectiblesDiscovered(): number {
  return Object.keys(collectiblesState()).length;
}

export function achievementMonstersKilled(): number {
  return Object.values(bestiaryState()).filter((entry) => entry.kills > 0)
    .length;
}

// What each counter reads, compared by value; a counter is only re-checked once one of them changes.
const ACHIEVEMENT_COUNTER_SOURCES: Record<
  AchievementCounter,
  (() => unknown)[]
> = {
  PartyLevel: [partyLowestLevel],
  RegionsVisited: [discoveredMapsState],
  RegionsSealed: [sealCount],
  WorkersRescued: [discoveredWorkersState],
  TownsHonored: [townTiers],
  TownsRenowned: [townTiers],
  MonstersAnalyzed: [monstersAnalyzed],
  MysticalFound: [discoveredEquipmentState],
  ShrinesMaxed: [shrinesState],
  OutpostsBuilt: [outpostsState],
  TradeskillLevel: [tradeskillTopLevel],
  TasksCompleted: [tasksCompleted],
  Remembrance: [
    achievementCollectiblesDiscovered,
    discoveredMaterialsState,
    discoveredEquipmentState,
    monstersDiscovered,
    discoveredWorkersState,
    shrinesState,
    outpostsState,
    gatherNodeLevelsState,
    tasksCompleted,
  ],
  JobsMastered: [jobsMasteredCount],
};

export function achievementCounterSources(
  counter: AchievementCounter,
): (() => unknown)[] {
  return ACHIEVEMENT_COUNTER_SOURCES[counter];
}

export function achievementCounter(
  counter: AchievementCounter,
): AchievementProgress {
  return ACHIEVEMENT_COUNTERS[counter]();
}
