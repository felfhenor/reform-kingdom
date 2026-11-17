import { combatRollAmbush } from '@helpers/combat/combat-ambush';
import { getEntry } from '@helpers/content/content';
import { exploreDifficultyTier } from '@helpers/engine/difficulty-tier';
import { encounterCreateFightCombat } from '@helpers/encounter/encounter';
import { characterReclassedTo } from '@helpers/hero/character-reclass';
import { characterStats } from '@helpers/hero/party';
import { canEquipItem, isSlotAvailableForJob } from '@helpers/item/equipment';
import { partyMinLevel } from '@helpers/item/gathering';
import { visitedWorldNodesState } from '@helpers/state-game';
import {
  worldNodeByName,
  worldNodeEncounter,
} from '@helpers/world-node/world-nodes';
import type {
  Character,
  CharacterId,
  ColosseumEncounterOption,
  ColosseumHeroEdit,
  ColosseumSetup,
  Combat,
  CombatSimulation,
  EncounterContent,
  EncounterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  EquipmentSlot,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';
import { sortBy, uniqBy } from 'es-toolkit/compat';

function colosseumEncounterOption(
  nodeName: string,
  level: number,
): ColosseumEncounterOption[] {
  const node = worldNodeByName(nodeName);
  const encounter = node ? worldNodeEncounter(node) : undefined;
  if (!encounter) return [];

  const tier = exploreDifficultyTier(encounter.levelRange, level);
  return [{ encounter, node, tier }];
}

export function colosseumEncounterOptions(): ColosseumEncounterOption[] {
  const level = partyMinLevel();
  const options = Object.keys(visitedWorldNodesState()).flatMap((name) =>
    colosseumEncounterOption(name, level),
  );
  return sortBy(
    uniqBy(options, (option) => option.encounter.id),
    [(o) => o.encounter.levelRange.min, (o) => o.encounter.name],
  );
}

// Everything the player owns: the armory plus whatever the real heroes wear.
export function colosseumGearPool(
  party: Character[],
  armory: EquipmentItem[],
): EquipmentItem[] {
  const worn = party.flatMap((character) =>
    Object.values(character.equipment).filter((item) => !!item),
  );
  return uniqBy([...worn, ...armory], (item) => item.id);
}

// One instance per item: the first hero (party order) to pick an item in the setup owns it.
export function colosseumGearClaims(
  realParty: Character[],
  setup: ColosseumSetup,
): Map<EquipmentItemId, CharacterId> {
  const claims = new Map<EquipmentItemId, CharacterId>();
  realParty.forEach((real) => {
    const edit = setup.heroes.find((e) => e.characterId === real.id);
    Object.values(edit?.equipment ?? {}).forEach((pick) => {
      if (pick && !claims.has(pick.itemId)) claims.set(pick.itemId, real.id);
    });
  });
  return claims;
}

function colosseumWearable(
  hero: Character,
  slot: EquipmentSlot,
  item: EquipmentItem,
): boolean {
  const content = getEntry<EquipmentContent>(item.equipmentId);
  return (
    !!content &&
    EquipmentTypeToSlot[content.type].includes(slot) &&
    canEquipItem(hero, content) &&
    isSlotAvailableForJob(slot, hero.jobId)
  );
}

// Applies slot edits, then drops what another hero claimed or this hero can't wear in their (possibly new) job.
function colosseumHeroEquipment(
  hero: Character,
  edit: ColosseumHeroEdit | undefined,
  pool: Map<EquipmentItemId, EquipmentItem>,
  claims: Map<EquipmentItemId, CharacterId>,
): EquipmentBlock {
  const equipment = { ...hero.equipment };
  Object.entries(edit?.equipment ?? {}).forEach(([slot, pick]) => {
    equipment[slot as EquipmentSlot] = pick ? pool.get(pick.itemId) : undefined;
  });

  (Object.keys(equipment) as EquipmentSlot[]).forEach((slot) => {
    const item = equipment[slot];
    const owner = item ? claims.get(item.id) : undefined;
    const taken = !!owner && owner !== hero.id;
    if (item && (taken || !colosseumWearable(hero, slot, item))) {
      equipment[slot] = undefined;
    }
  });
  return equipment;
}

function colosseumJobEdits(
  hero: Character,
  edit: ColosseumHeroEdit | undefined,
): Pick<Character, 'skillTreeNodes' | 'combatOrders' | 'burstSkills'> {
  const jobId = hero.jobId;
  const set = <T>(record: Partial<Record<string, T>>, value?: T) =>
    value ? { ...record, [jobId]: value } : record;
  return {
    skillTreeNodes: set(hero.skillTreeNodes, edit?.skillTreeNodes),
    combatOrders: set(hero.combatOrders, edit?.combatOrders),
    burstSkills: set(hero.burstSkills, edit?.burstSkillIds),
  };
}

export function colosseumHeroFromEdit(
  real: Character,
  edit: ColosseumHeroEdit | undefined,
  pool: Map<EquipmentItemId, EquipmentItem>,
  claims: Map<EquipmentItemId, CharacterId>,
): Character {
  const hero =
    edit?.jobId && edit.jobId !== real.jobId
      ? characterReclassedTo(real, edit.jobId)
      : real;
  const edited: Character = {
    ...hero,
    ...colosseumJobEdits(hero, edit),
    equipment: colosseumHeroEquipment(hero, edit, pool, claims),
  };

  // Every run starts fresh, even if the real hero is hurt or down.
  const stats = characterStats(edited);
  return { ...edited, stats, hp: stats.Health, ep: stats.Energy };
}

export function colosseumPartyFromSetup(
  realParty: Character[],
  setup: ColosseumSetup,
  armory: EquipmentItem[],
): Character[] {
  const pool = new Map(
    colosseumGearPool(realParty, armory).map((item) => [item.id, item]),
  );
  const claims = colosseumGearClaims(realParty, setup);
  return realParty.map((real) =>
    colosseumHeroFromEdit(
      real,
      setup.heroes.find((edit) => edit.characterId === real.id),
      pool,
      claims,
    ),
  );
}

// A private, mutable copy: committed party data is frozen and the engine edits combatants in place.
export function colosseumCreateFight(
  party: Character[],
  encounterId: EncounterId,
  fightIndex: number,
  simulation: CombatSimulation,
): Combat | undefined {
  const name = getEntry<EncounterContent>(encounterId)?.name ?? 'Colosseum';
  const created = encounterCreateFightCombat(
    encounterId,
    fightIndex,
    name,
    party,
  );
  if (!created) return undefined;

  return structuredClone({
    ...created,
    ambushedBy: combatRollAmbush(party),
    simulation,
  });
}
