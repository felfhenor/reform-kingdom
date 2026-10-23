import { categoryMessageLog } from '@helpers/combat/combat-log';
import {
  isWorldNodeDiscovered,
  worldNodeDiscover,
} from '@helpers/world-node/world-node-discovery';
import { isWorldNodeHidden } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

// Keeps the hidden/already-discovered check out of the map click handler.
export function worldNodeDiscoverIfHidden(entry: WorldNodeEntry): void {
  if (isWorldNodeHidden(entry) && !isWorldNodeDiscovered(entry.nodeName)) {
    worldNodeDiscover(entry.nodeName);
    categoryMessageLog(
      'Travel',
      entry.mapName,
      `You discovered **${entry.nodeName}**!`,
    );
  }
}
