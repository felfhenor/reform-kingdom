import { environment } from '@environments/environment';
import { getEntriesByType } from '@helpers/content/content';
import {
  findTeleportArrivalByTag,
  teleportNodeProperty,
} from '@helpers/pathfinding/pathfinding';
import { runStatsState } from '@helpers/state-game';
import type { RegionContent, WorldNodeEntry } from '@interfaces';

export function isDemoBuild(): boolean {
  return environment.demo;
}

// Only the demo build strips the maps that its exits lead to.
export function teleportIsDemoLocked(entry: WorldNodeEntry): boolean {
  if (entry.nodeData.type !== 'TeleportNode') return false;

  const toTag = teleportNodeProperty(entry, 'toTag');
  return !!toTag && !findTeleportArrivalByTag(toTag, true);
}

export function demoRegionsAllSealed(): boolean {
  const seals = runStatsState().seals;
  return getEntriesByType<RegionContent>('region').every(
    (region) => seals[region.id] !== undefined,
  );
}
