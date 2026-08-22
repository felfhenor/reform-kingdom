import { armoryGet } from '@helpers/armory';
import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import { defaultStats, defaultTagResistances } from '@helpers/defaults';
import {
  equipmentItemInfusionBonus,
  equipmentItemInfusionResistanceBonus,
} from '@helpers/infusion';
import { rngUuid } from '@helpers/rng';
import {
  EquipmentTypeToSlot,
  type BaseStat,
  type Character,
  type EquipmentArmoryEntry,
  type EquipmentBlock,
  type EquipmentContent,
  type EquipmentId,
  type EquipmentItem,
  type EquipmentItemId,
  type EquipmentItemType,
  type EquipmentSkillId,
  type EquipmentSlot,
  type JobContent,
  type JobId,
  type StatBlock,
  type StatusEffectTag,
} from '@interfaces';
import { orderBy, uniq } from 'es-toolkit/compat';

// Gear can be swapped freely while gathering, but not mid-fight.
export function canModifyEquipment(): boolean {
  return !currentCombat();
}

// A two-handed item occupies multiple paperdoll slots but is still one physical item (same instance id) - dedupe by instance id.
export function equippedItems(equipment: EquipmentBlock): EquipmentItem[] {
  const seen = new Set<EquipmentItemId>();

  return (
    Object.values(equipment) as EquipmentBlock[keyof EquipmentBlock][]
  ).filter((item): item is EquipmentItem => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// Like `equippedItems` but dedupes by primary slot (see `EquipmentTypeToSlot`) instead of instance id, for pickers needing "one row per physical item" even across legacy saves where a two-hander's slots don't share an instance id.
export function equippedItemsByPrimarySlot(
  equipment: EquipmentBlock,
): EquipmentItem[] {
  return (Object.keys(equipment) as EquipmentSlot[])
    .filter((slot) => {
      const item = equipment[slot];
      if (!item) return false;

      const content = getEntry<EquipmentContent>(item.equipmentId);
      return !!content && EquipmentTypeToSlot[content.type][0] === slot;
    })
    .map((slot) => equipment[slot] as EquipmentItem);
}

// Clears slots whose equipmentId no longer resolves to real content (e.g. renamed/removed gear).
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

// Class-unique slots per the design doc (Artifact/Mage, Ammo/Ranger), matched by job name (same convention as `party.ts`'s `STARTER_ARMOR_NAME`).
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

// Takes `armory` as a parameter (rather than reading `armoryGet()`) so it also works against a draft armory (see `planEquipmentOptimization`).
function equipmentEntriesForSlot(
  armory: EquipmentItem[],
  slot: EquipmentSlot,
): EquipmentArmoryEntry[] {
  const forSlot = armory
    .map((item) => {
      const content = getEntry<EquipmentContent>(item.equipmentId);
      return content && EquipmentTypeToSlot[content.type].includes(slot)
        ? { item, content }
        : undefined;
    })
    .filter((entry): entry is EquipmentArmoryEntry => !!entry);

  return orderBy(forSlot, [(entry) => entry.content.levelRequirement], ['desc']);
}

// Returns one entry per owned instance (not deduped by content id), so distinct physical copies (e.g. differently-infused swords) stay pickable.
export function equipmentAvailableForSlot(
  slot: EquipmentSlot,
): EquipmentArmoryEntry[] {
  return equipmentEntriesForSlot(armoryGet(), slot);
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

// Counts each distinct item once regardless of how many slots it occupies (see `equippedItems`).
export function equipmentStatTotals(equipment: EquipmentBlock): StatBlock {
  const totals = defaultStats();

  equippedItems(equipment).forEach((item) => {
    const content = getEntry<EquipmentContent>(item.equipmentId);
    if (!content) return;

    const infusionBonus = equipmentItemInfusionBonus(item.infusedItemIds);

    (Object.keys(totals) as Array<keyof StatBlock>).forEach((stat) => {
      totals[stat] += content.baseStats[stat] + infusionBonus[stat];
    });
  });

  return totals;
}

// Counts each distinct item once regardless of how many slots it occupies (see `equippedItems`).
export function equipmentTagResistanceTotals(
  equipment: EquipmentBlock,
): Record<StatusEffectTag, number> {
  const totals = defaultTagResistances();

  equippedItems(equipment).forEach((item) => {
    const content = getEntry<EquipmentContent>(item.equipmentId);
    if (!content) return;

    const infusionBonus = equipmentItemInfusionResistanceBonus(
      item.infusedItemIds,
    );

    (Object.keys(totals) as StatusEffectTag[]).forEach((tag) => {
      totals[tag] += (content.debuffResistances?.[tag] ?? 0) + infusionBonus[tag];
    });
  });

  return totals;
}

// Computed on demand (not baked into persisted `Character.stats`, which is
// a fixed 8-key `StatBlock` shape unrelated to this keyspace).
export function characterTagResistances(
  character: Character,
): Record<StatusEffectTag, number> {
  return equipmentTagResistanceTotals(character.equipment);
}

// Merging these into known skills is handled separately (see `mergeGrantedSkills`/`heroSkillsWithEquipment`), which needs skill content, not just ids.
export function equipmentGrantedSkillIds(
  equipment: EquipmentBlock,
): EquipmentSkillId[] {
  return uniq(
    equippedItems(equipment).flatMap(
      (item) =>
        getEntry<EquipmentContent>(item.equipmentId)?.grantedSkillIds ?? [],
    ),
  );
}

// Backfills instance identity for saves predating per-instance infusion
// tracking - existing armory/equipped entries only ever had `equipmentId`.
export function backfillEquipmentItem(item: EquipmentItem): EquipmentItem {
  return {
    id: item.id ?? (rngUuid() as EquipmentItemId),
    equipmentId: item.equipmentId,
    infusedItemIds: item.infusedItemIds ?? [],
  };
}

export function backfillEquipmentBlock(equipment: EquipmentBlock): EquipmentBlock {
  const backfilled = { ...equipment };

  (Object.keys(backfilled) as EquipmentSlot[]).forEach((slot) => {
    const item = backfilled[slot];
    if (item) {
      backfilled[slot] = backfillEquipmentItem(item);
    }
  });

  return backfilled;
}

// Two-handed-capable slots go first so they claim their secondary slot (e.g. Offhand) before anything else is chosen for it.
const SLOT_OPTIMIZATION_ORDER: EquipmentSlot[] = [
  'Weapon',
  'Offhand',
  'Armor',
  'Helmet',
  'Ring',
  'Accessory',
  'Artifact',
  'Ammo',
];

// A candidate's value for one stat, including its infusion bonus - used to
// rank candidates against a job's statPriority.
function candidateStatValue(entry: EquipmentArmoryEntry, stat: BaseStat): number {
  return (
    entry.content.baseStats[stat] +
    equipmentItemInfusionBonus(entry.item.infusedItemIds)[stat]
  );
}

// Ranks lexicographically by statPriority (a higher-priority stat always outweighs a lower one); ties fall back to `entries`'s existing order (highest level requirement first).
function bestBySlotPriority(
  entries: EquipmentArmoryEntry[],
  statPriority: BaseStat[],
): EquipmentArmoryEntry | undefined {
  if (entries.length === 0) return undefined;
  if (statPriority.length === 0) return entries[0];

  const iteratees = statPriority.map(
    (stat) => (entry: EquipmentArmoryEntry) => candidateStatValue(entry, stat),
  );

  return orderBy(entries, iteratees, statPriority.map(() => 'desc' as const))[0];
}

function currentEquipmentEntry(
  equipment: EquipmentBlock,
  slot: EquipmentSlot,
): EquipmentArmoryEntry | undefined {
  const item = equipment[slot];
  const content = item && getEntry<EquipmentContent>(item.equipmentId);
  return item && content ? { item, content } : undefined;
}

// Only returns slots that should change - a slot is omitted when nothing in the armory beats what's already equipped there.
export function planEquipmentOptimization(
  character: Character,
  armory: EquipmentItem[],
  statPriority: BaseStat[],
): EquipmentArmoryEntry[] {
  const claimedSlots = new Set<EquipmentSlot>();
  const usedItemIds = new Set<EquipmentItemId>();
  const winners: EquipmentArmoryEntry[] = [];

  SLOT_OPTIMIZATION_ORDER.forEach((slot) => {
    if (claimedSlots.has(slot) || !isSlotAvailableForJob(slot, character.jobId)) {
      return;
    }

    const current = currentEquipmentEntry(character.equipment, slot);
    const candidates = equipmentEntriesForSlot(armory, slot).filter(
      (entry) =>
        !usedItemIds.has(entry.item.id) && canEquipItem(character, entry.content),
    );
    const winner = bestBySlotPriority(
      current ? [...candidates, current] : candidates,
      statPriority,
    );
    if (!winner) return;

    EquipmentTypeToSlot[winner.content.type].forEach((s) => claimedSlots.add(s));

    if (winner.item.id !== current?.item.id) {
      winners.push(winner);
      usedItemIds.add(winner.item.id);
    }
  });

  return winners;
}
