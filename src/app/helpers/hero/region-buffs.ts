import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';
import { outpostBuffRefresh } from '@helpers/world-node/world-node-outpost-buff';

// Regional, not per-tile: town and outpost buffs apply anywhere on their node's map.
export function regionBuffsRefresh(mapName: string): void {
  void townReputationBuffRefresh(mapName);
  outpostBuffRefresh(mapName);
}

export function regionBuffsSync(
  previousMapName: string,
  currentMapName: string,
): void {
  if (previousMapName === currentMapName) return;
  regionBuffsRefresh(currentMapName);
}
