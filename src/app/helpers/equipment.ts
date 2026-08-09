import { armoryGet } from '@helpers/armory';
import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import { defaultStats } from '@helpers/defaults';
import { equipmentItemInfusionBonus } from '@helpers/infusion';
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
} from '@interfaces';
import { orderBy, uniq } from 'es-toolkit/compat';

// Gear can be swapped freely while gathering, but not mid-fight.
export function canModifyEquipment(): boolean {
  return !currentCombat();
}

// Returns each distinct equipped item once - a two-handed weapon (or any
// item with more than one entry in its own `slots`) occupies multiple
// paperdoll slots simultaneously, but is still a single physical item
// (same instance id in both slots).
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

// Like `equippedItems`, but resolves duplicates by paperdoll slot instead
// of instance id - a two-handed item is only ever returned for the first
// slot its type declares (see `EquipmentTypeToSlot`), never its secondary
// slot(s). Used by pickers (e.g. the Infusion page) that need "one row per
// physical item," since it doesn't depend on every slot referencing the
// exact same instance object the way `equippedItems`'s id-based dedup does.
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

// Resolves the entries of `armory` eligible for `slot` (by content type),
// sorted by level requirement descending. Takes the armory as a parameter
// rather than reading `armoryGet()` directly so it can also be used against
// a draft/in-progress armory (see `planEquipmentOptimization`).
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

// Only equipment actually sitting in the armory can be picked - this is the
// player's owned gear, not the full game content catalog. Returns one entry
// per owned *instance*, never deduped by content id, so distinct physical
// copies (e.g. differently-infused swords) stay individually pickable.
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

// Sums each distinct equipped item's baseStats plus its infusion bonus
// once, regardless of how many paperdoll slots it occupies (see
// `equippedItems`).
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

// Every skill granted by a distinct equipped item, deduped - see
// `EquipmentContent.grantedSkillIds`. Merging these into a hero's known
// skills is handled separately (see `mergeGrantedSkills`/
// `heroSkillsWithEquipment`), since that needs skill content, not just ids.
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

// Two-handed-capable slots are decided first so they claim their secondary
// slot (e.g. Offhand) before anything is chosen for it - see
// `planEquipmentOptimization`.
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

// Ranks candidates lexicographically by statPriority - a higher-priority
// stat always outweighs every lower-priority one, however small the
// difference. Stats past the end of the list (or ties throughout) fall back
// to `entries`'s existing order, i.e. highest level requirement first (see
// `equipmentEntriesForSlot`).
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

// Picks the best armory replacement for a character's equipment, slot by
// slot, ranked by their job's `statPriority` (descending). Only returns the
// slots that should change - a slot is omitted whenever nothing in the
// armory beats what's already equipped there, so callers never need to
// "re-equip" an already-optimal item. Each returned item appears once, even
// if it fills more than one slot (e.g. a two-handed weapon).
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
