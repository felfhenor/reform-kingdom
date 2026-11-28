import { contentNameById } from '@helpers/i18n/i18n-content';
import {
  colosseumEncounterOptions,
  colosseumGearPool,
} from '@helpers/colosseum/colosseum';
import { getEntry } from '@helpers/content/content';
import { localStorageSignal } from '@helpers/engine/signal';
import { getUnlockedJobs } from '@helpers/hero/job';
import type {
  Character,
  ColosseumGearPick,
  ColosseumHeroEdit,
  ColosseumSetup,
  ColosseumSetupPruneReport,
  EncounterContent,
  EquipmentItem,
  EquipmentSlot,
  SkillTreeNodeContent,
} from '@interfaces';

// Device-local and never part of the save, so nothing here can leak into a run.
export const colosseumSetup = localStorageSignal<ColosseumSetup>(
  'colosseumSetup',
  { heroes: [] },
);

function colosseumPruneGear(
  edit: ColosseumHeroEdit,
  owned: Set<string>,
  dropped: string[],
): ColosseumHeroEdit['equipment'] {
  if (!edit.equipment) return undefined;

  const kept: Partial<Record<EquipmentSlot, ColosseumGearPick | null>> = {};
  Object.entries(edit.equipment).forEach(([slot, pick]) => {
    if (!pick || owned.has(pick.itemId)) {
      kept[slot as EquipmentSlot] = pick;
      return;
    }
    const name = contentNameById(pick.equipmentId) ?? 'Gear';
    if (!dropped.includes(`${name} (no longer owned)`)) {
      dropped.push(`${name} (no longer owned)`);
    }
  });
  return kept;
}

function colosseumPruneTree(
  edit: ColosseumHeroEdit,
  hero: Character,
  dropped: string[],
): ColosseumHeroEdit['skillTreeNodes'] {
  const jobId = edit.jobId ?? hero.jobId;
  const nodes = edit.skillTreeNodes;
  const kept = nodes?.filter(
    (id) => getEntry<SkillTreeNodeContent>(id)?.jobId === jobId,
  );
  const lost = (nodes?.length ?? 0) - (kept?.length ?? 0);
  if (lost > 0) {
    dropped.push(
      `${lost} skill tree node${lost === 1 ? '' : 's'} on ${hero.name}`,
    );
  }
  // An emptied list would read as a deliberate empty tree; fall back to the real one instead.
  return kept?.length === 0 && lost > 0 ? undefined : kept;
}

function colosseumPruneHero(
  edit: ColosseumHeroEdit,
  hero: Character,
  owned: Set<string>,
  dropped: string[],
): ColosseumHeroEdit {
  const jobKnown =
    !edit.jobId || getUnlockedJobs().some((job) => job.id === edit.jobId);
  const base = jobKnown
    ? edit
    : { characterId: edit.characterId, equipment: edit.equipment };
  if (!jobKnown) dropped.push(`${hero.name}'s job`);

  return {
    ...base,
    equipment: colosseumPruneGear(base, owned, dropped),
    skillTreeNodes: colosseumPruneTree(base, hero, dropped),
  };
}

function colosseumPruneEncounter(
  setup: ColosseumSetup,
  dropped: string[],
): Pick<ColosseumSetup, 'encounterId' | 'fightIndex'> {
  const { encounterId, fightIndex } = setup;
  if (!encounterId) return {};

  const visited = colosseumEncounterOptions().some(
    (option) => option.encounter.id === encounterId,
  );
  const encounter = getEntry<EncounterContent>(encounterId);
  if (!visited || !encounter) {
    dropped.push(`${encounter?.name ?? 'A location'} (not visited)`);
    return {};
  }

  const validFight =
    fightIndex !== undefined && fightIndex < encounter.fights.length;
  return { encounterId, fightIndex: validFight ? fightIndex : undefined };
}

// Drops whatever no longer exists (sold gear, unknown heroes, unvisited places, retired tree nodes) and names it.
export function colosseumSetupPrune(
  setup: ColosseumSetup,
  party: Character[],
  armory: EquipmentItem[],
): ColosseumSetupPruneReport {
  const dropped: string[] = [];
  const owned = new Set<string>(
    colosseumGearPool(party, armory).map((item) => item.id),
  );

  const heroes = setup.heroes.flatMap((edit) => {
    const hero = party.find((c) => c.id === edit.characterId);
    return hero ? [colosseumPruneHero(edit, hero, owned, dropped)] : [];
  });

  return {
    setup: { ...colosseumPruneEncounter(setup, dropped), heroes },
    dropped,
  };
}
