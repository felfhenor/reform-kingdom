import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { characterStatsForLevel, partyGet } from '@helpers/hero/party';
import {
  canEquipItem,
  canModifyEquipment,
  planEquipmentOptimization,
  slotsHoldingEquipment,
} from '@helpers/item/equipment';
import {
  canInfuseEquipmentItem,
  infusionMaterialCost,
} from '@helpers/item/infusion';
import { applyMaterialDelta, spendGold } from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import { updateGamestate } from '@helpers/state-game';
import {
  EquipmentTypeToSlot,
  type Character,
  type CharacterId,
  type EquipmentBlock,
  type EquipmentContent,
  type EquipmentItem,
  type EquipmentItemId,
  type EquipmentSlot,
  type ItemContent,
  type ItemId,
  type JobContent,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Recomputes derived stats after an equipment change and clamps current hp/ep to the new max.
export function applyEquipmentToCharacter(
  character: Character,
  equipment: EquipmentBlock,
): Character {
  const stats = characterStatsForLevel(
    character.jobId,
    character.level,
    equipment,
  );

  return {
    ...character,
    equipment,
    stats,
    hp: clamp(character.hp, 0, stats.Health),
    ep: clamp(character.ep, 0, stats.Energy),
  };
}

// Equips into every slot the item's type declares (e.g. two-handed fills Weapon+Offhand),
// fully displacing whatever occupied those slots (and any other slots they held) back to the armory as whole items.
export function characterEquipFromArmory(
  characterId: CharacterId,
  equipmentItemId: EquipmentItemId,
): boolean {
  if (!canModifyEquipment()) return false;

  const character = partyGet().find((c) => c.id === characterId);
  if (!character) return false;

  const armoryItem = armoryGet().find((item) => item.id === equipmentItemId);
  if (!armoryItem) return false;

  const equipmentContent = getEntry<EquipmentContent>(armoryItem.equipmentId);
  if (!equipmentContent || !canEquipItem(character, equipmentContent)) {
    return false;
  }

  const targetSlots = EquipmentTypeToSlot[equipmentContent.type];

  // Keyed by instance id so the exact displaced item, infusions included, goes back to the armory.
  const displacedItems = new Map<EquipmentItemId, EquipmentItem>();
  targetSlots.forEach((slot) => {
    const existing = character.equipment[slot];
    if (existing && existing.id !== armoryItem.id) {
      displacedItems.set(existing.id, existing);
    }
  });

  const clearedSlots = new Set<EquipmentSlot>(targetSlots);
  displacedItems.forEach((displacedItem) => {
    slotsHoldingEquipment(
      character.equipment,
      displacedItem.equipmentId,
    ).forEach((slot) => clearedSlots.add(slot));
  });

  updateGamestate((state) => {
    const armoryIndex = state.armory.findIndex(
      (item) => item.id === equipmentItemId,
    );
    if (armoryIndex === -1) return state;

    state.armory = [
      ...state.armory.filter((_, index) => index !== armoryIndex),
      ...Array.from(displacedItems.values()),
    ];

    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const equipment = { ...c.equipment };
      clearedSlots.forEach((slot) => {
        equipment[slot] = undefined;
      });
      targetSlots.forEach((slot) => {
        equipment[slot] = armoryItem;
      });

      return applyEquipmentToCharacter(c, equipment);
    });

    return state;
  });

  analyticsSendDesignEvent(
    `Hero:Equip:Item:${analyticsSafeSegment(equipmentContent.name)}`,
  );
  return true;
}

// Backs the manual "Optimize Equipment" button; reclassing runs its own pass instead, to stay atomic with the job swap.
export function optimizeCharacterEquipment(characterId: CharacterId): void {
  const character = partyGet().find((c) => c.id === characterId);
  if (!character) return;

  const job = getEntry<JobContent>(character.jobId);
  if (!job) return;

  const winners = planEquipmentOptimization(
    character,
    armoryGet(),
    job.statPriority,
  );
  winners.forEach((winner) =>
    characterEquipFromArmory(characterId, winner.item.id),
  );
}

// Infuses a specific slot index (not "next open"); overwriting an already-filled slot is allowed with no refund for what was displaced.
export function characterInfuseEquipment(
  characterId: CharacterId,
  equipmentItemId: EquipmentItemId,
  slotIndex: number,
  materialItemId: ItemId,
): boolean {
  if (!canModifyEquipment()) return false;

  const character = partyGet().find((c) => c.id === characterId);
  if (!character) return false;

  const occupiedSlots = (
    Object.keys(character.equipment) as EquipmentSlot[]
  ).filter((slot) => character.equipment[slot]?.id === equipmentItemId);
  if (occupiedSlots.length === 0) return false;

  const item = character.equipment[occupiedSlots[0]];
  if (!item || !canInfuseEquipmentItem(item, slotIndex, materialItemId)) {
    return false;
  }

  const infusedItemIds = [...item.infusedItemIds];
  infusedItemIds[slotIndex] = materialItemId;
  const infusedItem: EquipmentItem = { ...item, infusedItemIds };
  const cost = infusionMaterialCost(materialItemId);
  const materialContent = getEntry<ItemContent>(materialItemId);

  updateGamestate((state) => {
    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const equipment = { ...c.equipment };
      occupiedSlots.forEach((slot) => {
        equipment[slot] = infusedItem;
      });

      return applyEquipmentToCharacter(c, equipment);
    });

    applyMaterialDelta(state, materialItemId, -1);
    spendGold(state, cost);

    return state;
  });

  analyticsSendDesignEvent(
    materialContent
      ? `Hero:Infuse:Item:${analyticsSafeSegment(materialContent.name)}`
      : 'Hero:Infuse:Item',
  );
  return true;
}
