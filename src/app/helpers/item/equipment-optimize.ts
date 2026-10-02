import { getEntry } from '@helpers/content/content';
import {
  affixEffectsOfKind,
  equipmentItemAffixEffects,
} from '@helpers/item/affix';
import {
  canEquipItem,
  equipmentEntriesForSlot,
  equippedItems,
  isSlotAvailableForJob,
} from '@helpers/item/equipment';
import {
  equipmentSlotGroups,
  equipmentSlotLayouts,
  equipmentSlotPatterns,
  equipmentSlotsKey,
} from '@helpers/item/equipment-slot-groups';
import { equipmentItemInfusionBonus } from '@helpers/item/infusion';
import type {
  BaseStat,
  Character,
  EquipmentArmoryEntry,
  EquipmentBlock,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  EquipmentSlot,
  JobStatPriority,
} from '@interfaces';
import { EquipmentTypeToSlot, StatOrder } from '@interfaces';

import { compact, orderBy, sortBy, sumBy, uniqBy } from 'es-toolkit/compat';

// A hero is never optimized out of a weapon, even when a lone offhand would outscore it.
const REQUIRED_SLOTS: EquipmentSlot[] = ['Weapon'];

function candidateStatValue(
  entry: EquipmentArmoryEntry,
  stat: BaseStat,
): number {
  return (
    entry.content.baseStats[stat] +
    equipmentItemInfusionBonus(entry.item.infusedItemIds)[stat] +
    sumBy(
      affixEffectsOfKind(equipmentItemAffixEffects(entry.item), 'Stat'),
      (effect) => (effect.stat === stat ? effect.value : 0),
    )
  );
}

function candidateScore(
  entry: EquipmentArmoryEntry,
  statPriority: JobStatPriority[],
): number {
  const nonPriorityStats = StatOrder.filter(
    (stat) => !statPriority.some((prio) => prio.stat === stat),
  );

  return (
    sumBy(
      statPriority,
      (prio) => candidateStatValue(entry, prio.stat) * prio.multiplier,
    ) + sumBy(nonPriorityStats, (stat) => candidateStatValue(entry, stat))
  );
}

// Layout scoring revisits the same items many times.
function memoizedScore(
  statPriority: JobStatPriority[],
): (entry: EquipmentArmoryEntry) => number {
  const scores = new Map<EquipmentItemId, number>();
  return (entry) => {
    const cached = scores.get(entry.item.id);
    if (cached !== undefined) return cached;
    const score = candidateScore(entry, statPriority);
    scores.set(entry.item.id, score);
    return score;
  };
}

function currentEquipmentEntry(
  equipment: EquipmentBlock,
  slot: EquipmentSlot,
): EquipmentArmoryEntry | undefined {
  const item = equipment[slot];
  const content = item
    ? getEntry<EquipmentContent>(item.equipmentId)
    : undefined;
  return item && content ? { item, content } : undefined;
}

function slotCandidates(
  character: Character,
  armory: EquipmentItem[],
  slot: EquipmentSlot,
): EquipmentArmoryEntry[] {
  const current = currentEquipmentEntry(character.equipment, slot);
  const candidates = equipmentEntriesForSlot(armory, slot).filter((entry) =>
    canEquipItem(character, entry.content),
  );
  return current ? [current, ...candidates] : candidates;
}

// Stable sort with the worn item listed first, so a tie keeps it.
function bestPatternCandidate(
  character: Character,
  armory: EquipmentItem[],
  pattern: EquipmentSlot[],
  score: (entry: EquipmentArmoryEntry) => number,
): EquipmentArmoryEntry | undefined {
  const key = equipmentSlotsKey(pattern);
  const fitting = slotCandidates(character, armory, pattern[0]).filter(
    (entry) =>
      equipmentSlotsKey(EquipmentTypeToSlot[entry.content.type]) === key,
  );
  return orderBy(fitting, score, 'desc')[0];
}

// Read at the primary slot only, so a legacy two-hander split across two instances counts once.
function wornInPrimarySlots(
  equipment: EquipmentBlock,
  slots: EquipmentSlot[],
): EquipmentArmoryEntry[] {
  return compact(
    slots.map((slot) => {
      const entry = currentEquipmentEntry(equipment, slot);
      const isPrimary =
        !!entry && EquipmentTypeToSlot[entry.content.type][0] === slot;
      return isPrimary ? entry : undefined;
    }),
  );
}

// Worn items stay unless a pick claims a slot holding the same equipment id - matching the equip path, which displaces by content id.
function resultingLoadout(
  equipment: EquipmentBlock,
  groupSlots: EquipmentSlot[],
  picks: EquipmentArmoryEntry[],
): EquipmentArmoryEntry[] {
  const claimed = new Set(
    picks.flatMap((pick) => EquipmentTypeToSlot[pick.content.type]),
  );
  const kept = wornInPrimarySlots(equipment, groupSlots).filter(
    (entry) =>
      !groupSlots.some(
        (slot) =>
          claimed.has(slot) &&
          equipment[slot]?.equipmentId === entry.item.equipmentId,
      ),
  );
  // Sorted so identical sets always sum in the same order and tie exactly.
  return sortBy(uniqBy([...picks, ...kept], 'item.id'), 'item.id');
}

function requiredSlotsFilled(loadout: EquipmentArmoryEntry[]): number {
  return REQUIRED_SLOTS.filter((slot) =>
    loadout.some((entry) =>
      EquipmentTypeToSlot[entry.content.type].includes(slot),
    ),
  ).length;
}

function bestLayoutPicks(
  character: Character,
  groupSlots: EquipmentSlot[],
  layouts: EquipmentArmoryEntry[][],
  score: (entry: EquipmentArmoryEntry) => number,
): EquipmentArmoryEntry[] {
  const equippedIds = new Set(
    equippedItems(character.equipment).map((item) => item.id),
  );
  const ranked = layouts.map((picks) => {
    const loadout = resultingLoadout(character.equipment, groupSlots, picks);
    return {
      picks,
      required: requiredSlotsFilled(loadout),
      score: sumBy(loadout, score),
      changes: picks.filter((pick) => !equippedIds.has(pick.item.id)).length,
    };
  });

  return (
    orderBy(
      ranked,
      ['required', 'score', 'changes'],
      ['desc', 'desc', 'asc'],
    )[0]?.picks ?? []
  );
}

function planSlotGroup(
  character: Character,
  armory: EquipmentItem[],
  groupSlots: EquipmentSlot[],
  score: (entry: EquipmentArmoryEntry) => number,
): EquipmentArmoryEntry[] {
  const patterns = equipmentSlotPatterns().filter((pattern) =>
    pattern.every((slot) => groupSlots.includes(slot)),
  );
  const bestByPattern = new Map(
    patterns.map((pattern) => [
      equipmentSlotsKey(pattern),
      bestPatternCandidate(character, armory, pattern, score),
    ]),
  );
  const layouts = equipmentSlotLayouts(groupSlots, patterns).map((layout) =>
    compact(
      layout.map((pattern) => bestByPattern.get(equipmentSlotsKey(pattern))),
    ),
  );

  return bestLayoutPicks(character, groupSlots, layouts, score);
}

// Only returns items that should be equipped - anything already equipped that stays the best pick is omitted.
export function planEquipmentOptimization(
  character: Character,
  armory: EquipmentItem[],
  statPriority: JobStatPriority[],
): EquipmentArmoryEntry[] {
  const score = memoizedScore(statPriority);
  const equippedIds = new Set(
    equippedItems(character.equipment).map((item) => item.id),
  );

  return equipmentSlotGroups()
    .map((group) =>
      group.filter((slot) => isSlotAvailableForJob(slot, character.jobId)),
    )
    .filter((group) => group.length > 0)
    .flatMap((group) => planSlotGroup(character, armory, group, score))
    .filter((entry) => !equippedIds.has(entry.item.id));
}
