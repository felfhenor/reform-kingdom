import {
  HERO_BURST_SKILL_SLOTS,
  REGALIA_NAME_MAX_LENGTH,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { burstSkillIdFor } from '@helpers/hero/burst-skill';
import {
  backfillEquipmentItem,
  canEquipItem,
  equippedItems,
} from '@helpers/item/equipment';
import { pruneInvalidArmoryItems } from '@helpers/kingdom/armory';
import type {
  Character,
  CharacterId,
  EquipmentArmoryEntry,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  EquipmentSlot,
  GameStateRegalias,
  JobContent,
  JobId,
  Regalia,
  RegaliaId,
  RegaliaMissingItem,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';
import { cloneDeep, isEqual, partition, sortBy, uniq } from 'es-toolkit/compat';

export function characterJobRegalias(
  entries: Regalia[],
  characterId: CharacterId,
  jobId: JobId,
): Regalia[] {
  return entries.filter(
    (regalia) => regalia.characterId === characterId && regalia.jobId === jobId,
  );
}

export function characterCurrentRegalia(
  entries: Regalia[],
  character: Character,
): Regalia | undefined {
  const regaliaId = character.currentRegaliaIds[character.jobId];
  return regaliaId
    ? entries.find((regalia) => regalia.id === regaliaId)
    : undefined;
}

function characterEquippedItemIds(character: Character): EquipmentItemId[] {
  return equippedItems(character.equipment).map((item) => item.id);
}

// cloneDeep rather than structuredClone - the character may be an Immer draft.
export function regaliaSnapshot(
  character: Character,
  id: RegaliaId,
  name: string,
): Regalia {
  return {
    id,
    name,
    characterId: character.id,
    jobId: character.jobId,
    equipmentItemIds: characterEquippedItemIds(character),
    combatOrders: cloneDeep(character.combatOrders[character.jobId] ?? []),
    burstSkillIds: [...(character.burstSkills[character.jobId] ?? [])],
  };
}

export function regaliaMatchesCharacter(
  regalia: Regalia,
  character: Character,
): boolean {
  const jobId = character.jobId;
  return (
    regalia.jobId === jobId &&
    isEqual(
      sortBy(regalia.equipmentItemIds),
      sortBy(characterEquippedItemIds(character)),
    ) &&
    isEqual(regalia.combatOrders, character.combatOrders[jobId] ?? []) &&
    isEqual(regalia.burstSkillIds, character.burstSkills[jobId] ?? [])
  );
}

// Loads equip in regalia order, so a later item whose slots overlap an earlier one's pushes it back out.
function regaliaDisplacedItemIds(
  loadable: EquipmentArmoryEntry[],
): EquipmentItemId[] {
  const slotOwners = new Map<EquipmentSlot, EquipmentItemId>();

  loadable.forEach(({ item, content }) => {
    EquipmentTypeToSlot[content.type].forEach((slot) => {
      const displacedId = slotOwners.get(slot);
      [...slotOwners].forEach(([ownedSlot, ownerId]) => {
        if (ownerId === displacedId) slotOwners.delete(ownedSlot);
      });
      slotOwners.set(slot, item.id);
    });
  });

  const kept = new Set(slotOwners.values());
  return loadable.map(({ item }) => item.id).filter((id) => !kept.has(id));
}

function regaliaUnusableItem(
  id: EquipmentItemId,
  owned: EquipmentItem[],
  character: Character,
): RegaliaMissingItem | EquipmentArmoryEntry {
  const item = owned.find((ownedItem) => ownedItem.id === id);
  if (!item) return { id, reason: 'gone' };

  const content = getEntry<EquipmentContent>(item.equipmentId);
  return content && canEquipItem(character, content)
    ? { item, content }
    : { id, reason: 'unequippable' };
}

// `available` is everything a load can pull from besides the hero's own gear: the vault and the armory.
export function regaliaMissingItems(
  regalia: Regalia,
  character: Character,
  available: EquipmentItem[],
): RegaliaMissingItem[] {
  const owned = [...equippedItems(character.equipment), ...available];
  const [missing, loadable] = partition(
    regalia.equipmentItemIds.map((id) =>
      regaliaUnusableItem(id, owned, character),
    ),
    (entry): entry is RegaliaMissingItem => 'reason' in entry,
  ) as [RegaliaMissingItem[], EquipmentArmoryEntry[]];

  return [
    ...missing,
    ...regaliaDisplacedItemIds(loadable).map((id): RegaliaMissingItem => ({
      id,
      reason: 'displaced',
    })),
  ];
}

export function regaliaNameClean(name: string, fallback: string): string {
  const cleaned = name.trim().slice(0, REGALIA_NAME_MAX_LENGTH).trim();
  return cleaned.length > 0
    ? cleaned
    : fallback.slice(0, REGALIA_NAME_MAX_LENGTH);
}

export function regaliaDefaultName(jobId: JobId, existingCount: number) {
  const jobName = getEntry<JobContent>(jobId)?.name ?? 'Hero';
  return regaliaNameClean('', `${jobName} Regalia ${existingCount + 1}`);
}

export function pruneInvalidRegalias(
  regalias: GameStateRegalias,
  party: Character[],
): GameStateRegalias {
  const entries = regalias.entries
    .filter(
      (regalia) =>
        party.some((character) => character.id === regalia.characterId) &&
        !!getEntry<JobContent>(regalia.jobId),
    )
    .map((regalia) => ({
      ...regalia,
      equipmentItemIds: uniq(regalia.equipmentItemIds),
      burstSkillIds: uniq(regalia.burstSkillIds.flatMap(burstSkillIdFor)).slice(
        0,
        HERO_BURST_SKILL_SLOTS,
      ),
    }));

  return {
    entries,
    vault: pruneInvalidArmoryItems(regalias.vault.map(backfillEquipmentItem)),
  };
}

export function pruneInvalidCurrentRegaliaIds(
  currentRegaliaIds: Character['currentRegaliaIds'] | undefined,
  entries: Regalia[],
): Character['currentRegaliaIds'] {
  const pruned: Character['currentRegaliaIds'] = {};

  (Object.keys(currentRegaliaIds ?? {}) as JobId[]).forEach((jobId) => {
    const regaliaId = currentRegaliaIds?.[jobId];
    if (entries.some((r) => r.id === regaliaId && r.jobId === jobId)) {
      pruned[jobId] = regaliaId;
    }
  });

  return pruned;
}
