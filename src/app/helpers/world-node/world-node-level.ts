import { gatherNodeLevelsState } from '@helpers/state-game';

// Absent entry (or a missing gatherNodeLevels, e.g. mid-migration on an old save) means level 0.
export function worldNodeLevel(nodeName: string): number {
  return gatherNodeLevelsState()?.[nodeName]?.level ?? 0;
}
