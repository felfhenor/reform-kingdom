import { getEntry } from '@helpers/content/content';
import {
  affixEffectsOfKind,
  equipmentItemAffixEffects,
  rollAffixIds,
} from '@helpers/item/affix';
import {
  affixEffectsAddToBlock,
  COMBAT_STAT_BONUS,
  equipmentItemBonusTotals,
  equipmentItemGatherYieldBonuses,
  MONSTER_TYPE_DAMAGE_BONUS,
  RESISTANCE_BONUS,
  STAT_BONUS,
} from '@helpers/item/equipment-bonus';
import { rngUuid } from '@helpers/rng';
import { worldCombatState } from '@helpers/state-game';
import { characterTeachingEffects } from '@helpers/trainer/trainer-teaching';
import type {
  AffixEffect,
  AffixId,
  Character,
  CombatStatBlock,
  EquipmentArmoryEntry,
  EquipmentBlock,
  EquipmentBonusDimension,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  EquipmentItemType,
  EquipmentSkillId,
  EquipmentSlot,
  GatherYieldBonus,
  JobContent,
  JobId,
  MonsterType,
  StatBlock,
  StatusEffectBlock,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';

import { orderBy, uniq } from 'es-toolkit/compat';

// Gear can be swapped freely while gathering, but not mid-fight.
export function canModifyEquipment(): boolean {
  return !worldCombatState();
}

// Single construction site for a fresh EquipmentItem - every drop/craft/purchase/starter-gear path should use this instead of an inline literal.
// affixIds overrides the normal rarity roll - used by debug tooling to force a specific affix combination.
export function newEquipmentItem(
  equipmentId: EquipmentId,
  affixIds?: AffixId[],
): EquipmentItem {
  const content = getEntry<EquipmentContent>(equipmentId);

  return {
    id: rngUuid() as EquipmentItemId,
    equipmentId,
    infusedItemIds: [],
    affixIds:
      affixIds ??
      (content ? rollAffixIds(content.rarity, content.levelRequirement) : []),
  };
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

// Dedupes by primary slot instead of instance id, for pickers needing "one row per physical item" even across legacy saves where a two-hander's slots don't share an instance id.
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

// Class-unique slots per the design doc (Artifact/Mage, Ammo/Ranger), matched by job name.
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

// Takes `armory` as a parameter rather than reading it globally, so it also works against a draft armory.
export function equipmentEntriesForSlot(
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

  return orderBy(
    forSlot,
    [(entry) => entry.content.levelRequirement],
    ['desc'],
  );
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

// Sums one dimension's total (base content + infusion + affix) across every
// equipped item, counting a two-hander once even though it fills two slots.
function equipmentDimensionTotals<K extends string>(
  equipment: EquipmentBlock,
  dimension: EquipmentBonusDimension<K>,
): Record<K, number> {
  const totals = dimension.defaultBlock();

  equippedItems(equipment).forEach((item) => {
    const content = getEntry<EquipmentContent>(item.equipmentId);
    if (!content) return;

    const bonus = equipmentItemBonusTotals(item, dimension);
    const base = dimension.equipmentBlock(content);

    (Object.keys(totals) as K[]).forEach((key) => {
      totals[key] += (base?.[key] ?? 0) + bonus[key];
    });
  });

  return totals;
}

export function equipmentStatTotals(equipment: EquipmentBlock): StatBlock {
  return equipmentDimensionTotals(equipment, STAT_BONUS);
}

// Applied at combat creation, not baked into `Character.stats`.
export function equipmentCombatStatTotals(
  equipment: EquipmentBlock,
): CombatStatBlock {
  return equipmentDimensionTotals(equipment, COMBAT_STAT_BONUS);
}

export function equipmentTagResistanceTotals(
  equipment: EquipmentBlock,
): StatusEffectBlock {
  return equipmentDimensionTotals(equipment, RESISTANCE_BONUS);
}

// Counts each distinct item once regardless of how many slots it occupies.
export function equipmentAffixEffects(
  equipment: EquipmentBlock,
): AffixEffect[] {
  return equippedItems(equipment).flatMap(equipmentItemAffixEffects);
}

// Base equipment content plus affixes, summed per MonsterType for the MonsterTypeDamage combat bonus.
export function equipmentMonsterTypeDamageTotals(
  equipment: EquipmentBlock,
): Record<MonsterType, number> {
  return equipmentDimensionTotals(equipment, MONSTER_TYPE_DAMAGE_BONUS);
}

// Base + infusion + affix gather yield bonuses across every equipped item - TradeskillId is dynamic content, so this can't be a fixed-key `EquipmentBonusDimension` like the others.
export function equipmentGatherYieldBonuses(
  equipment: EquipmentBlock,
): GatherYieldBonus[] {
  return equippedItems(equipment).flatMap((item) => {
    const content = getEntry<EquipmentContent>(item.equipmentId);
    return content ? equipmentItemGatherYieldBonuses(content, item) : [];
  });
}

export function characterTagResistances(
  character: Character,
): StatusEffectBlock {
  return affixEffectsAddToBlock(
    equipmentTagResistanceTotals(character.equipment),
    characterTeachingEffects(character),
    RESISTANCE_BONUS,
  );
}

// Excludes the in-combat baseline, which is meaningless outside a combatant.
export function characterCombatStatBonusTotals(
  character: Character,
): CombatStatBlock {
  return affixEffectsAddToBlock(
    equipmentCombatStatTotals(character.equipment),
    characterTeachingEffects(character),
    COMBAT_STAT_BONUS,
  );
}

// Merging these into known skills is handled separately, which needs skill content, not just ids.
export function equipmentGrantedSkillIds(
  equipment: EquipmentBlock,
): EquipmentSkillId[] {
  return uniq(
    equippedItems(equipment).flatMap((item) => {
      const contentSkillIds =
        getEntry<EquipmentContent>(item.equipmentId)?.grantedSkillIds ?? [];
      const affixSkillIds = affixEffectsOfKind(
        equipmentItemAffixEffects(item),
        'GrantSkill',
      ).map((effect) => effect.skillId);

      return [...contentSkillIds, ...affixSkillIds];
    }),
  );
}

// Backfills instance identity for saves predating per-instance infusion
// tracking - existing armory/equipped entries only ever had `equipmentId`.
export function backfillEquipmentItem(item: EquipmentItem): EquipmentItem {
  return {
    id: item.id ?? (rngUuid() as EquipmentItemId),
    equipmentId: item.equipmentId,
    infusedItemIds: item.infusedItemIds ?? [],
    affixIds: item.affixIds ?? [],
  };
}

export function backfillEquipmentBlock(
  equipment: EquipmentBlock,
): EquipmentBlock {
  const backfilled = { ...equipment };

  (Object.keys(backfilled) as EquipmentSlot[]).forEach((slot) => {
    const item = backfilled[slot];
    if (item) {
      backfilled[slot] = backfillEquipmentItem(item);
    }
  });

  return backfilled;
}
