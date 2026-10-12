import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import {
  gatherNodeLevelsState,
  outpostsState,
  shrinesState,
} from '@helpers/state-game';
import {
  stateCanAffordCost,
  worldNodeSpendCost,
} from '@helpers/world-node/world-node-cost';
import {
  worldNodeDevelopmentIsMaxLevel,
  worldNodeDevelopmentLevelUpCost,
  worldNodeDevelopmentTime,
} from '@helpers/world-node/world-node-development';
import {
  worldNodeByName,
  worldNodeGathering,
  worldNodeOutpost,
  worldNodeShrine,
} from '@helpers/world-node/world-nodes';
import type {
  GameState,
  GameStateWorldNodeDevelopmentSlice,
  GameStateWorldNodeLevel,
  WorldNodeDevelopableContent,
  WorldNodeDevelopableType,
  WorldNodeDevelopmentDue,
} from '@interfaces';

export const WORLD_NODE_DEVELOPMENT_SLICES: Record<
  WorldNodeDevelopableType,
  GameStateWorldNodeDevelopmentSlice
> = {
  gathering: 'gatherNodeLevels',
  shrine: 'shrines',
  outpost: 'outposts',
};

export const WORLD_NODE_DEVELOPMENT_ANALYTICS_SEGMENTS: Record<
  WorldNodeDevelopableType,
  string
> = {
  gathering: 'GatherNode',
  shrine: 'Shrine',
  outpost: 'Outpost',
};

const WORLD_NODE_DEVELOPMENT_SELECTORS = {
  gathering: gatherNodeLevelsState,
  shrine: shrinesState,
  outpost: outpostsState,
} satisfies Record<WorldNodeDevelopableType, unknown>;

export const WORLD_NODE_DEVELOPABLE_TYPES = Object.keys(
  WORLD_NODE_DEVELOPMENT_SLICES,
) as WorldNodeDevelopableType[];

export function worldNodeDevelopable(
  nodeName: string,
): WorldNodeDevelopableContent | undefined {
  const node = worldNodeByName(nodeName);
  if (!node) return undefined;

  return (
    worldNodeGathering(node) ?? worldNodeShrine(node) ?? worldNodeOutpost(node)
  );
}

// Absent entry (or a missing slice, e.g. mid-migration on an old save) means level 0 with nothing pending.
function worldNodeDevelopmentEntry(
  nodeName: string,
): GameStateWorldNodeLevel | undefined {
  const content = worldNodeDevelopable(nodeName);
  return content
    ? WORLD_NODE_DEVELOPMENT_SELECTORS[content.__type]()?.[nodeName]
    : undefined;
}

export function worldNodeDevelopmentLevel(nodeName: string): number {
  return worldNodeDevelopmentEntry(nodeName)?.level ?? 0;
}

export function worldNodeDevelopmentTicksRemaining(
  nodeName: string,
): number | undefined {
  const completesAt =
    worldNodeDevelopmentEntry(nodeName)?.developCompletesAtTick;
  return completesAt === undefined
    ? undefined
    : Math.max(0, completesAt - timerTicksElapsed());
}

export function worldNodeDevelopmentTimerText(
  nodeName: string,
): string | undefined {
  const remaining = worldNodeDevelopmentTicksRemaining(nodeName);
  return remaining === undefined ? undefined : formatDuration(remaining);
}

// Mutates `state`; returns the level being developed towards, or 0 if nothing started.
export function worldNodeDevelopmentBegin(
  state: GameState,
  nodeName: string,
  content: WorldNodeDevelopableContent,
): number {
  const slice = state[WORLD_NODE_DEVELOPMENT_SLICES[content.__type]];
  const current = slice[nodeName] ?? { level: 0 };
  if (current.developCompletesAtTick !== undefined) return 0;
  if (worldNodeDevelopmentIsMaxLevel(content, current.level)) return 0;

  const cost = worldNodeDevelopmentLevelUpCost(content, current.level);
  if (!stateCanAffordCost(state, cost)) return 0;

  worldNodeSpendCost(state, cost);
  slice[nodeName] = {
    level: current.level,
    developCompletesAtTick:
      state.clock.numTicks + worldNodeDevelopmentTime(content, current.level),
  };
  return current.level + 1;
}

function worldNodeDevelopmentsDueOfType(
  type: WorldNodeDevelopableType,
  nowTick: number,
): WorldNodeDevelopmentDue[] {
  const levels = WORLD_NODE_DEVELOPMENT_SELECTORS[type]() ?? {};
  return Object.keys(levels).flatMap((nodeName) => {
    const { level, developCompletesAtTick } = levels[nodeName];
    if (
      developCompletesAtTick === undefined ||
      developCompletesAtTick > nowTick
    )
      return [];

    const content = worldNodeDevelopable(nodeName);
    return content?.__type === type
      ? [{ nodeName, content, level: level + 1 }]
      : [];
  });
}

export function worldNodeDevelopmentsDue(
  nowTick: number,
): WorldNodeDevelopmentDue[] {
  return WORLD_NODE_DEVELOPABLE_TYPES.flatMap((type) =>
    worldNodeDevelopmentsDueOfType(type, nowTick),
  );
}
