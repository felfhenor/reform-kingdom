import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { applyEquipmentToCharacter } from '@helpers/hero/character-equipment';
import { partyGet } from '@helpers/hero/party';
import {
  canModifyEquipment,
  newEquipmentItem,
  slotsHoldingEquipment,
} from '@helpers/item/equipment';
import { updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentSlot,
} from '@interfaces';

function applyCharacterEquipment(
  characterId: CharacterId,
  equipmentForCharacter: (character: Character) => EquipmentBlock,
): boolean {
  if (!canModifyEquipment()) return false;

  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      if (character.id !== characterId) return character;

      return applyEquipmentToCharacter(
        character,
        equipmentForCharacter(character),
      );
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

// Unequips a hero's item back to the armory, clearing every slot it occupies (e.g. both hands of a two-hander) as a single entry.
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
  const equipmentContent = getEntry<EquipmentContent>(previousItem.equipmentId);

  updateGamestate((state) => {
    state.armory = [...state.armory, previousItem];

    state.world.party = state.world.party.map((c) => {
      if (c.id !== characterId) return c;

      const equipment = { ...c.equipment };
      occupiedSlots.forEach((occupiedSlot) => {
        equipment[occupiedSlot] = undefined;
      });

      return applyEquipmentToCharacter(c, equipment);
    });

    return state;
  });

  analyticsSendDesignEvent(
    equipmentContent
      ? `Hero:Unequip:Item:${analyticsSafeSegment(equipmentContent.name)}`
      : 'Hero:Unequip:Item',
  );
  return true;
}
