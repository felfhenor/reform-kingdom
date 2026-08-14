import { armoryGet } from '@helpers/armory';
import { getEntry } from '@helpers/content';
import {
  canEquipItem,
  canModifyEquipment,
  planEquipmentOptimization,
  slotsHoldingEquipment,
} from '@helpers/equipment';
import { canInfuseEquipmentItem, infusionMaterialCost } from '@helpers/infusion';
import { applyMaterialDelta, spendGold } from '@helpers/materials';
import { characterStatsForLevel, newEquipmentItem, partyGet } from '@helpers/party';
import { updateGamestate } from '@helpers/state-game';
import {
  EquipmentTypeToSlot,
  type Character,
  type CharacterId,
  type EquipmentBlock,
  type EquipmentContent,
  type EquipmentId,
  type EquipmentItem,
  type EquipmentItemId,
  type EquipmentSlot,
  type ItemId,
  type JobContent,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

function applyCharacterEquipment(
  characterId: CharacterId,
  equipmentForCharacter: (character: Character) => EquipmentBlock,
): boolean {
  if (!canModifyEquipment()) return false;

  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      if (character.id !== characterId) return character;

      const equipment = equipmentForCharacter(character);
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
    });

    return state;
  });

  return true;
}

// Returns false (without changing state) if equipment cannot currently be
// modified, e.g. while the party is in combat.
export function characterEquipItem(
  characterId: CharacterId,
  slot: EquipmentSlot,
  equipmentId: EquipmentId,
): boolean {
  return applyCharacterEquipment(characterId, (character) => ({
    ...character.equipment,
    [slot]: newEquipmentItem(equipmentId),
  }));
}

// Returns false (without changing state) if equipment cannot currently be
// modified, e.g. while the party is in combat.
export function characterUnequipItem(
  characterId: CharacterId,
  slot: EquipmentSlot,
): boolean {
  return applyCharacterEquipment(characterId, (character) => ({
    ...character.equipment,
    [slot]: undefined,
  }));
}

// Equips an armory item onto a hero, occupying every slot the item's
// content declares (e.g. a two-handed weapon fills both Weapon and Offhand
// at once). Any item(s) currently occupying those slots are fully displaced
// - including from any *other* slot they themselves occupy, so partially
// overwriting one hand of an already-equipped two-hander frees the other
// hand too - and returned to the armory as whole items, not duplicated per
// slot. Atomic: a failed check never partially mutates either side. Returns
// false without changing state if equipment can't currently be modified,
// the item isn't eligible (level/class), or the item isn't actually in the
// armory.
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

  // Keyed by instance id (not content id) so the exact displaced physical
  // item - with whatever it's infused with - is what goes back to the
  // armory, not a freshly reconstructed bare item.
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

      const stats = characterStatsForLevel(c.jobId, c.level, equipment);

      return {
        ...c,
        equipment,
        stats,
        hp: clamp(c.hp, 0, stats.Health),
        ep: clamp(c.ep, 0, stats.Energy),
      };
    });

    return state;
  });

  return true;
}

// Moves a hero's currently-equipped item (if any) back into the armory,
// clearing every slot it occupies (a two-handed weapon frees both hands at
// once, as a single armory entry, not one per slot). Returns false without
// changing state if equipment can't currently be modified or the slot is
// already empty.
export function characterUnequipToArmory(
  characterId: CharacterId,
  slot: EquipmentSlot,
): boolean {
  if (!canModifyEquipment()) return false;

  const character = partyGet().find((c) => c.id === characterId);
  const previousItem = character?.equipment[slot];
  if (!character || !previousItem) return false;

  const occupiedSlots = slotsHoldingEquipment(
    character.equipment,
    previousItem.equipmentId,
  );

  updateGamestate((state) => {
    state.armory = [...state.armory, previousItem];

    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const equipment = { ...c.equipment };
      occupiedSlots.forEach((occupiedSlot) => {
        equipment[occupiedSlot] = undefined;
      });

      const stats = characterStatsForLevel(c.jobId, c.level, equipment);

      return {
        ...c,
        equipment,
        stats,
        hp: clamp(c.hp, 0, stats.Health),
        ep: clamp(c.ep, 0, stats.Energy),
      };
    });

    return state;
  });

  return true;
}

// Equips the best armory item for every eligible slot, ranked by the hero's
// job `statPriority` (see `planEquipmentOptimization`). Slots where nothing
// in the armory beats what's already equipped are left untouched. Backs the
// manual "Optimize Equipment" button; reclassing runs its own optimization
// pass inline instead (see `characterReclass`), since it needs to happen
// atomically with the job swap rather than against live gamestate.
export function optimizeCharacterEquipment(characterId: CharacterId): void {
  const character = partyGet().find((c) => c.id === characterId);
  if (!character) return;

  const job = getEntry<JobContent>(character.jobId);
  if (!job) return;

  const winners = planEquipmentOptimization(character, armoryGet(), job.statPriority);
  winners.forEach((winner) => characterEquipFromArmory(characterId, winner.item.id));
}

// Permanently infuses a material into one of a hero's equipped item's
// slots, paid for in Gold Coin. Targets a specific slot index rather than
// "the next open one" - infusing an already-filled slot is allowed and
// simply overwrites its bonus, with no refund for what was displaced.
// Returns false without changing state if equipment can't currently be
// modified, the item/slot/material combination isn't valid, or the player
// can't afford it.
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

  updateGamestate((state) => {
    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const equipment = { ...c.equipment };
      occupiedSlots.forEach((slot) => {
        equipment[slot] = infusedItem;
      });

      const stats = characterStatsForLevel(c.jobId, c.level, equipment);

      return {
        ...c,
        equipment,
        stats,
        hp: clamp(c.hp, 0, stats.Health),
        ep: clamp(c.ep, 0, stats.Energy),
      };
    });

    applyMaterialDelta(state, materialItemId, -1);
    spendGold(state, cost);

    return state;
  });

  return true;
}
