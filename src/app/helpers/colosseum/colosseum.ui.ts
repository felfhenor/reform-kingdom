import type { Character, EquipmentItemId } from '@interfaces';

// The sim hero wearing `itemId`, if any; one hero may fill two slots with a two-hander.
export function colosseumGearWornBy(
  party: Character[],
  itemId: EquipmentItemId,
): Character | undefined {
  return party.find((character) =>
    Object.values(character.equipment).some((item) => item?.id === itemId),
  );
}
