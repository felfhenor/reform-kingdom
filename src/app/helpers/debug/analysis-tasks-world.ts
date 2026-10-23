import { getEntry } from '@helpers/content/content';
import { analysisFail } from '@helpers/debug/analysis-utils';
import { allMaps } from '@helpers/maps';
import { teleportNodeProperty } from '@helpers/pathfinding/pathfinding';
import { taskRequirementNodeName } from '@helpers/task/task';
import {
  isWorldNodeHidden,
  kingdomNodeGet,
  worldNodeByName,
  worldNodeCollectibleGateIds,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodeShrine,
  worldNodesOfType,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import type {
  AnalysisIssue,
  AstralProjectorContent,
  AstralProjectorId,
  CollectibleId,
  ItemId,
  MonsterId,
  TaskContent,
  TaskRequirement,
  WorldNodeEntry,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// Collectibles an earlier task is guaranteed to hand the player, so gates on them are fair game.
function guaranteedCollectibleIds(
  earlierTasks: TaskContent[],
): CollectibleId[] {
  return earlierTasks.flatMap((task) => {
    const { requirement } = task;
    if (requirement.kind === 'OwnCollectible') {
      return [requirement.collectibleId];
    }
    if (requirement.kind !== 'ClearEncounter') return [];

    const entry = worldNodeByName(requirement.nodeName);
    const encounter = entry ? worldNodeEncounter(entry) : undefined;
    return (encounter?.completionRewards ?? []).flatMap((reward) =>
      'collectibleId' in reward && reward.chance >= 100
        ? [reward.collectibleId]
        : [],
    );
  });
}

function isNodeGateMet(
  entry: WorldNodeEntry,
  guaranteed: CollectibleId[],
): boolean {
  return worldNodeCollectibleGateIds(entry).every((id) =>
    guaranteed.includes(id),
  );
}

// Maps reachable from the Duchy through teleports that are visible, or whose gate an earlier task guarantees.
function reachableMapNames(guaranteed: CollectibleId[]): Set<string> {
  const teleports = worldNodesOfType('TeleportNode');
  const start = kingdomNodeGet()?.mapName;
  const reached = new Set<string>(start ? [start] : []);
  let frontier = [...reached];

  while (frontier.length > 0) {
    frontier = teleports
      .filter(
        (node) =>
          frontier.includes(node.mapName) &&
          !isWorldNodeHidden(node) &&
          isNodeGateMet(node, guaranteed),
      )
      .map((node) => teleportNodeProperty(node, 'toTag'))
      .map((toTag) =>
        teleports.find((node) => teleportNodeProperty(node, 'tag') === toTag),
      )
      .map((arrival) => arrival?.mapName)
      .filter(
        (mapName): mapName is string => !!mapName && !reached.has(mapName),
      );
    frontier = uniq(frontier);
    frontier.forEach((mapName) => reached.add(mapName));
  }

  return reached;
}

function nodeVisibilityIssues(
  entry: WorldNodeEntry,
  guaranteed: CollectibleId[],
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  if (isWorldNodeHidden(entry)) {
    issues.push(analysisFail(`"${entry.nodeName}" is a hidden node`));
  }

  if (!isNodeGateMet(entry, guaranteed)) {
    issues.push(
      analysisFail(
        `"${entry.nodeName}" is gated by collectibles no earlier task guarantees`,
      ),
    );
  }

  if (!reachableMapNames(guaranteed).has(entry.mapName)) {
    issues.push(
      analysisFail(
        `"${entry.nodeName}" is on ${entry.mapName}, which is only reachable through hidden or ungranted gated teleports`,
      ),
    );
  }

  return issues;
}

function gatherNodeIssues(
  entry: WorldNodeEntry,
  itemId: ItemId,
): AnalysisIssue[] {
  const gathering = worldNodeGathering(entry);
  if (!gathering) {
    return [analysisFail(`"${entry.nodeName}" is not a gather node`)];
  }

  const resultItemIds = gathering.gatherResults.flatMap((result) =>
    result.items.map((item) => item.itemId),
  );
  return resultItemIds.includes(itemId)
    ? []
    : [analysisFail(`"${entry.nodeName}" never yields the required item`)];
}

function shrineLevelIssues(
  entry: WorldNodeEntry,
  level: number,
): AnalysisIssue[] {
  const levels = worldNodeShrine(entry)?.levels.length ?? 0;
  return levels >= level
    ? []
    : [analysisFail(`"${entry.nodeName}" has no shrine level ${level}`)];
}

function nodeTypeIssues(
  requirement: TaskRequirement,
  entry: WorldNodeEntry,
): AnalysisIssue[] {
  switch (requirement.kind) {
    case 'GatherItem':
      return gatherNodeIssues(entry, requirement.itemId);
    case 'ClearEncounter':
      return worldNodeEncounter(entry) || worldNodeEncounterRandom(entry)
        ? []
        : [analysisFail(`"${entry.nodeName}" is not an explore node`)];
    case 'ShrineLevel':
      return shrineLevelIssues(entry, requirement.level);
    case 'VisitTown':
    case 'TownReputationTier':
      return worldNodeTown(entry)
        ? []
        : [analysisFail(`"${entry.nodeName}" is not a town`)];
    default:
      return [];
  }
}

function isNodeOpenAndReachable(
  entry: WorldNodeEntry,
  guaranteed: CollectibleId[],
): boolean {
  return (
    !isWorldNodeHidden(entry) &&
    isNodeGateMet(entry, guaranteed) &&
    reachableMapNames(guaranteed).has(entry.mapName)
  );
}

function nodeSpawnsMonster(
  entry: WorldNodeEntry,
  monsterId: MonsterId,
): boolean {
  const encounterMonsterIds =
    worldNodeEncounter(entry)?.fights.flatMap((fight) =>
      fight.monsters.map((monster) => monster.monsterId),
    ) ?? [];
  const poolMonsterIds =
    worldNodeEncounterRandom(entry)?.creaturePool.map(
      (monster) => monster.monsterId,
    ) ?? [];
  return [...encounterMonsterIds, ...poolMonsterIds].includes(monsterId);
}

function monsterSpawnIssues(
  monsterId: MonsterId,
  guaranteed: CollectibleId[],
): AnalysisIssue[] {
  const spawnNodes = [
    ...worldNodesOfType('ExploreNode'),
    ...worldNodesOfType('ExploreRandomNode'),
  ].filter((entry) => nodeSpawnsMonster(entry, monsterId));

  return spawnNodes.some((entry) => isNodeOpenAndReachable(entry, guaranteed))
    ? []
    : [analysisFail('the monster never spawns on a findable, reachable node')];
}

function castSpellIssues(
  astralProjectorId: AstralProjectorId,
  guaranteed: CollectibleId[],
): AnalysisIssue[] {
  const spell = getEntry<AstralProjectorContent>(astralProjectorId);
  const missing = (spell?.requiredCollectibles ?? []).filter(
    ({ collectibleId }) => !guaranteed.includes(collectibleId),
  );
  return missing.length === 0
    ? []
    : [analysisFail('the spell needs collectibles no earlier task guarantees')];
}

function requirementGateIssues(
  requirement: TaskRequirement,
  guaranteed: CollectibleId[],
): AnalysisIssue[] {
  if (requirement.kind === 'DefeatMonster') {
    return monsterSpawnIssues(requirement.monsterId, guaranteed);
  }
  if (requirement.kind === 'CastAstralSpell') {
    return castSpellIssues(requirement.astralProjectorId, guaranteed);
  }
  return [];
}

function requirementNodeIssues(
  requirement: TaskRequirement,
  guaranteed: CollectibleId[],
): AnalysisIssue[] {
  const nodeName = taskRequirementNodeName(requirement);
  if (!nodeName) return [];

  const entry = worldNodeByName(nodeName);
  if (!entry) return [analysisFail(`"${nodeName}" is not placed on any map`)];

  return [
    ...nodeTypeIssues(requirement, entry),
    ...nodeVisibilityIssues(entry, guaranteed),
  ];
}

function mapVisitIssues(
  task: TaskContent,
  guaranteed: CollectibleId[],
): AnalysisIssue[] {
  const mapName = task.requireMapVisit;
  if (!mapName) return [analysisFail('requireMapVisit is missing')];
  if (!allMaps().has(mapName)) {
    return [analysisFail(`requireMapVisit "${mapName}" is not a map`)];
  }
  if (!reachableMapNames(guaranteed).has(mapName)) {
    return [analysisFail(`requireMapVisit "${mapName}" is not reachable`)];
  }
  return [];
}

export function taskNodeIssues(
  task: TaskContent,
  earlierTasks: TaskContent[],
): AnalysisIssue[] {
  const guaranteed = guaranteedCollectibleIds(earlierTasks);
  return [
    ...requirementNodeIssues(task.requirement, guaranteed),
    ...requirementGateIssues(task.requirement, guaranteed),
    ...mapVisitIssues(task, guaranteed),
  ];
}
