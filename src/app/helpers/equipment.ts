import { armoryGet } from '@helpers/armory';
import { currentCombat } from '@helpers/combat';
import { getEntriesByType, getEntry } from '@helpers/content';
import { defaultStats } from '@helpers/defaults';
import {
  EquipmentTypeToSlot,
  type Character,
  type EquipmentBlock,
  type EquipmentContent,
  type EquipmentId,
  type EquipmentItem,
  type EquipmentItemType,
  type EquipmentSlot,
  type JobContent,
  type JobId,
  type StatBlock,
} from '@interfaces';
import { orderBy } from 'es-toolkit/compat';

// Gear can be swapped freely while gathering, but not mid-fight.
export function canModifyEquipment(): boolean {
  return !currentCombat();
}

// Returns each distinct equipped item once - a two-handed weapon (or any
// item with more than one entry in its own `slots`) occupies multiple
// paperdoll slots simultaneously, but is still a single physical item.
export function equippedItems(equipment: EquipmentBlock): EquipmentItem[] {
  const seen = new Set<EquipmentId>();

  return (
    Object.values(equipment) as EquipmentBlock[keyof EquipmentBlock][]
  ).filter((item): item is EquipmentItem => {
    if (!item || seen.has(item.equipmentId)) return false;
    seen.add(item.equipmentId);
    return true;
  });
}

// Clears any slot whose equipped item's equipmentId no longer resolves to
// real content - e.g. after a piece of gear is renamed/removed from
// gamedata.
export function pruneInvalidEquippedItems(
  equipment: EquipmentBlock,
): EquipmentBlock {
  const pruned = { ...equipment };

  (Object.keys(pruned) as EquipmentSlot[]).forEach((slot) => {
    const item = pruned[slot];
    if (item && !getEntry<EquipmentContent>(item.equipmentId)) {
      pruned[slot] = undefined;
    }
  });

  return pruned;
}

// Every slot currently holding this exact equipment id - used to find every
// slot a multi-slot item occupies when it needs to be unequipped/displaced.
export function slotsHoldingEquipment(
  equipment: EquipmentBlock,
  equipmentId: EquipmentId,
): EquipmentSlot[] {
  return (Object.keys(equipment) as EquipmentSlot[]).filter(
    (slot) => equipment[slot]?.equipmentId === equipmentId,
  );
}

// Class-unique slots per the design doc (Artifact/Mage, Ammo/Ranger) -
// matched by job name, the same "match content by name" convention
// `party.ts` uses for `STARTER_ARMOR_NAME`.
const CLASS_EXCLUSIVE_SLOT_JOBS: Partial<Record<EquipmentSlot, string>> = {
  Artifact: 'Magician',
  Ammo: 'Ranger',
};

export function isSlotAvailableForJob(
  slot: EquipmentSlot,
  jobId: JobId,
): boolean {
  const requiredJobName = CLASS_EXCLUSIVE_SLOT_JOBS[slot];
  if (!requiredJobName) return true;

  return getEntry<JobContent>(jobId)?.name === requiredJobName;
}

export function canEquipItem(
  character: Character,
  equipment: EquipmentContent,
): boolean {
  if (character.level < equipment.levelRequirement) return false;

  const job = getEntry<JobContent>(character.jobId);
  if (!job) return false;

  return job.equippableTypes.includes(equipment.type);
}

// Only equipment actually sitting in the armory can be picked - this is the
// player's owned gear, not the full game content catalog.
export function equipmentAvailableForSlot(
  slot: EquipmentSlot,
): EquipmentContent[] {
  const ownedIds = new Set(armoryGet().map((item) => item.equipmentId));

  const forSlot = getEntriesByType<EquipmentContent>('equipment').filter(
    (item) =>
      ownedIds.has(item.id) && EquipmentTypeToSlot[item.type].includes(slot),
  );

  return orderBy(forSlot, ['levelRequirement'], ['desc']);
}

// Resolves each distinct equipped item to its content `type` (e.g. `Bow`,
// `Sword`) - used to check weapon-type requirements for skills.
export function equippedItemTypes(
  equipment: EquipmentBlock,
): EquipmentItemType[] {
  return equippedItems(equipment)
    .map((item) => getEntry<EquipmentContent>(item.equipmentId)?.type)
    .filter((type): type is EquipmentItemType => !!type);
}

// Sums each distinct equipped item's baseStats once, regardless of how many
// paperdoll slots it occupies (see `equippedItems`).
export function equipmentStatTotals(equipment: EquipmentBlock): StatBlock {
  const totals = defaultStats();

  equippedItems(equipment).forEach((item) => {
    const content = getEntry<EquipmentContent>(item.equipmentId);
    if (!content) return;

    (Object.keys(totals) as Array<keyof StatBlock>).forEach((stat) => {
      totals[stat] += content.baseStats[stat];
    });
  });

  return totals;
}
