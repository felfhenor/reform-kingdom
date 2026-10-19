import { REGALIA_MAX_PER_JOB } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { defaultEquipment } from '@helpers/defaults';
import { stateEquipFromArmory } from '@helpers/hero/character-equipment';
import { characterRecalculateStats } from '@helpers/hero/party';
import {
  characterCurrentRegalia,
  characterJobRegalias,
  pruneInvalidCurrentRegaliaIds,
  pruneInvalidRegalias,
  regaliaDefaultName,
  regaliaSnapshot,
} from '@helpers/hero/regalia';
import { canEquipItem, equippedItems } from '@helpers/item/equipment';
import { syncArmoryGlobalEffects } from '@helpers/kingdom/armory-global-effects';
import { characterJobLevel } from '@helpers/hero/job';
import { skillTreePrune } from '@helpers/hero/skill-tree';
import type {
  Character,
  CharacterId,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  JobId,
  Regalia,
  RegaliaId,
} from '@interfaces';
import { cloneDeep, partition } from 'es-toolkit/compat';

function stateCharacter(
  state: GameState,
  characterId: CharacterId,
): Character | undefined {
  return state.world.party.find((character) => character.id === characterId);
}

// Gear the outgoing regalia references waits in the vault; anything else goes back to the armory.
export function stateCharacterUnequipForRegalia(
  state: GameState,
  characterId: CharacterId,
): void {
  const character = stateCharacter(state, characterId);
  if (!character) return;

  const regalia = characterCurrentRegalia(state.regalias.entries, character);
  const [kept, released] = partition(
    equippedItems(character.equipment),
    (item) => !!regalia?.equipmentItemIds.includes(item.id),
  );

  state.regalias.vault.push(...kept);
  state.armory.push(...released);
  character.equipment = defaultEquipment();
}

function stateRegaliaEquipItem(
  state: GameState,
  characterId: CharacterId,
  itemId: EquipmentItemId,
): void {
  const character = stateCharacter(state, characterId);
  const item = state.armory.find((owned) => owned.id === itemId);
  const content = item
    ? getEntry<EquipmentContent>(item.equipmentId)
    : undefined;
  if (!character || !item || !content || !canEquipItem(character, content)) {
    return;
  }

  stateEquipFromArmory(state, characterId, item, content);
}

function stateVaultReleaseItems(
  state: GameState,
  shouldRelease: (item: EquipmentItem) => boolean,
): void {
  const [released, kept] = partition(state.regalias.vault, shouldRelease);
  if (released.length === 0) return;

  state.regalias.vault = kept;
  state.armory.push(...released);
}

// Routes through the armory so equipping reuses the normal slot/displacement rules; unequippable leftovers stay in the armory.
export function stateRegaliaLoad(
  state: GameState,
  characterId: CharacterId,
  regalia: Regalia,
): void {
  stateVaultReleaseItems(state, (item) =>
    regalia.equipmentItemIds.includes(item.id),
  );
  regalia.equipmentItemIds.forEach((itemId) =>
    stateRegaliaEquipItem(state, characterId, itemId),
  );

  const character = stateCharacter(state, characterId);
  if (!character) return;

  character.combatOrders[regalia.jobId] = cloneDeep(regalia.combatOrders);
  character.burstSkills[regalia.jobId] = [...regalia.burstSkillIds];
  // Switching builds is free; pruned in case the hero's level for this job dropped since the snapshot.
  character.skillTreeNodes[regalia.jobId] = skillTreePrune(
    regalia.jobId,
    regalia.skillTreeNodeIds,
    characterJobLevel(character, regalia.jobId),
  );
  character.currentRegaliaIds[regalia.jobId] = regalia.id;
  Object.assign(character, characterRecalculateStats(character));
}

export function stateRegaliaVaultReconcile(state: GameState): void {
  const referenced = new Set(
    state.regalias.entries.flatMap((regalia) => regalia.equipmentItemIds),
  );
  stateVaultReleaseItems(state, (item) => !referenced.has(item.id));
}

export function stateRegaliaSettle(state: GameState): void {
  stateRegaliaVaultReconcile(state);
  syncArmoryGlobalEffects(state);
}

// Returns the job the regalia was made for, or undefined if the hero is missing or at the cap.
export function stateRegaliaCreate(
  state: GameState,
  characterId: CharacterId,
  id: RegaliaId,
): JobId | undefined {
  const character = stateCharacter(state, characterId);
  if (!character) return undefined;

  const jobId = character.jobId;
  const count = characterJobRegalias(
    state.regalias.entries,
    characterId,
    jobId,
  ).length;
  if (count >= REGALIA_MAX_PER_JOB) return undefined;

  const name = regaliaDefaultName(jobId, count);
  state.regalias.entries.push(regaliaSnapshot(character, id, name));
  character.currentRegaliaIds[jobId] = id;
  return jobId;
}

export function stateRegaliaEquip(
  state: GameState,
  characterId: CharacterId,
  regaliaId: RegaliaId,
): JobId | undefined {
  const character = stateCharacter(state, characterId);
  const regalia = state.regalias.entries.find((r) => r.id === regaliaId);
  if (!character || regalia?.characterId !== characterId) return undefined;
  if (regalia.jobId !== character.jobId) return undefined;

  stateCharacterUnequipForRegalia(state, characterId);
  stateRegaliaLoad(state, characterId, regalia);
  stateRegaliaSettle(state);
  return regalia.jobId;
}

export function stateRegaliaUpdate(
  state: GameState,
  characterId: CharacterId,
): JobId | undefined {
  const character = stateCharacter(state, characterId);
  const current = character
    ? characterCurrentRegalia(state.regalias.entries, character)
    : undefined;
  if (!character || !current) return undefined;

  const index = state.regalias.entries.indexOf(current);
  state.regalias.entries[index] = regaliaSnapshot(
    character,
    current.id,
    current.name,
  );
  stateRegaliaSettle(state);
  return character.jobId;
}

// Gear on the hero stays equipped; anything only this regalia held returns to the armory.
export function stateRegaliaRemove(
  state: GameState,
  regaliaId: RegaliaId,
): JobId | undefined {
  const regalia = state.regalias.entries.find((r) => r.id === regaliaId);
  if (!regalia) return undefined;

  const jobId = regalia.jobId;
  state.regalias.entries = state.regalias.entries.filter(
    (r) => r.id !== regaliaId,
  );
  state.world.party.forEach((character) => {
    if (character.currentRegaliaIds[jobId] === regaliaId) {
      delete character.currentRegaliaIds[jobId];
    }
  });
  stateRegaliaSettle(state);
  return jobId;
}

// Load-time cleanup; vault gear left unreferenced by pruning goes back to the armory.
export function stateRegaliaMigrate(state: GameState): void {
  state.regalias = pruneInvalidRegalias(state.regalias, state.world.party);
  state.world.party.forEach((character) => {
    character.currentRegaliaIds = pruneInvalidCurrentRegaliaIds(
      character.currentRegaliaIds,
      state.regalias.entries,
    );
  });
  stateRegaliaVaultReconcile(state);
}
