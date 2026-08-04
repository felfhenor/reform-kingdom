import { gamestate } from '@helpers/state-game';
import type { EquipmentItem } from '@interfaces';

export function armoryGet(): EquipmentItem[] {
  return gamestate().armory;
}
