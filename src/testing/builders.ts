import { newEquipmentItem } from '@helpers/item/equipment';
import type {
  CraftQueueEntry,
  CraftQueueEntryId,
  EquipmentId,
  EquipmentItem,
  RecipeId,
  TownNodeState,
} from '@interfaces';

export function buildTownNodeState(
  overrides: Partial<TownNodeState> = {},
): TownNodeState {
  return {
    lastProcessedTick: {},
    stock: [],
    workers: {},
    reputation: 0,
    hiddenGold: 0,
    materials: {},
    tradeskills: {},
    craftQueue: [],
    commissionSlots: [],
    specialtyPriority: [],
    ...overrides,
  };
}

export function buildCraftQueueEntry(
  overrides: Partial<CraftQueueEntry> & { recipeId: RecipeId },
): CraftQueueEntry {
  return {
    id: `queue-${overrides.recipeId}` as CraftQueueEntryId,
    quantityTotal: 1,
    quantityCompleted: 0,
    ticksIntoCraft: 0,
    reservedEquipment: [],
    ...overrides,
  };
}

export function buildEquipmentItem(
  equipmentId: EquipmentId,
  overrides: Partial<EquipmentItem> = {},
): EquipmentItem {
  return { ...newEquipmentItem(equipmentId, []), ...overrides };
}
