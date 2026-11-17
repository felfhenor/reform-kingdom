import { getEntry } from '@helpers/content/content';
import { characterReclassedTo } from '@helpers/hero/character-reclass';
import {
  characterSkillTreeNodeIds,
  skillTreeIdsWithoutPresent,
  skillTreePrune,
} from '@helpers/hero/skill-tree';
import { characterSkillTreeNodeRanks } from '@helpers/hero/skill-tree.ui';
import type {
  Character,
  ColosseumHeroEdit,
  ColosseumSetup,
  EquipmentContent,
  EquipmentItem,
  EquipmentSlot,
  JobId,
  SkillTreeNodeId,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';
import { uniq } from 'es-toolkit/compat';

export function colosseumHeroIsEdited(
  edit: ColosseumHeroEdit | undefined,
): boolean {
  return (
    !!edit &&
    (!!edit.jobId ||
      !!edit.equipment ||
      !!edit.skillTreeNodes ||
      !!edit.combatOrders ||
      !!edit.burstSkillIds)
  );
}

// Tree, orders and burst edits belong to one job, so the first of them pins it.
export function colosseumSetupEditHero(
  setup: ColosseumSetup,
  real: Character,
  patch: Omit<ColosseumHeroEdit, 'characterId'>,
): ColosseumSetup {
  const edit = setup.heroes.find((e) => e.characterId === real.id);
  const others = setup.heroes.filter((e) => e.characterId !== real.id);
  const pinsJob =
    !!patch.skillTreeNodes || !!patch.combatOrders || !!patch.burstSkillIds;
  const jobId =
    patch.jobId ?? edit?.jobId ?? (pinsJob ? real.jobId : undefined);
  return {
    ...setup,
    heroes: [...others, { ...edit, ...patch, jobId, characterId: real.id }],
  };
}

export function colosseumSetupResetHero(
  setup: ColosseumSetup,
  real: Character,
): ColosseumSetup {
  return {
    ...setup,
    heroes: setup.heroes.filter((edit) => edit.characterId !== real.id),
  };
}

// Reclassed once here, so default orders (fresh ids each derive) are stored and stay stable.
export function colosseumSetupPickJob(
  setup: ColosseumSetup,
  real: Character,
  jobId: JobId,
): ColosseumSetup {
  const equipment = setup.heroes.find(
    (e) => e.characterId === real.id,
  )?.equipment;
  const reset = colosseumSetupResetHero(setup, real);
  if (jobId === real.jobId) {
    return equipment
      ? colosseumSetupEditHero(reset, real, { equipment })
      : reset;
  }

  const copy = characterReclassedTo(real, jobId);
  return colosseumSetupEditHero(reset, real, {
    jobId,
    equipment,
    skillTreeNodes: copy.skillTreeNodes[jobId] ?? [],
    combatOrders: copy.combatOrders[jobId] ?? [],
    burstSkillIds: copy.burstSkills[jobId] ?? [],
  });
}

function colosseumItemSlots(item: EquipmentItem): EquipmentSlot[] {
  const content = getEntry<EquipmentContent>(item.equipmentId);
  return content ? EquipmentTypeToSlot[content.type] : [];
}

// The slots an item lands in, plus every slot of whatever two-hander it displaces.
function colosseumSlotsTouched(
  sim: Character,
  slots: EquipmentSlot[],
): EquipmentSlot[] {
  const displaced = slots.flatMap((slot) => {
    const current = sim.equipment[slot];
    return current ? colosseumItemSlots(current) : [];
  });
  return uniq([...slots, ...displaced]);
}

// Moving an item to this hero takes it out of every other hero's picks.
function colosseumSetupReleaseItem(
  setup: ColosseumSetup,
  real: Character,
  item?: EquipmentItem,
): ColosseumSetup {
  if (!item) return setup;
  const heroes = setup.heroes.map((edit) => {
    if (edit.characterId === real.id || !edit.equipment) return edit;
    const equipment = Object.fromEntries(
      Object.entries(edit.equipment).filter(
        ([, pick]) => pick?.itemId !== item.id,
      ),
    );
    return { ...edit, equipment };
  });
  return { ...setup, heroes };
}

// `sim` is the hero as currently simulated; unequipping passes no item.
export function colosseumSetupEquip(
  setup: ColosseumSetup,
  real: Character,
  sim: Character,
  slot: EquipmentSlot,
  item?: EquipmentItem,
): ColosseumSetup {
  const target = item ? colosseumItemSlots(item) : [slot];
  const pick = item ? { itemId: item.id, equipmentId: item.equipmentId } : null;
  const released = colosseumSetupReleaseItem(setup, real, item);
  const edit = released.heroes.find((e) => e.characterId === real.id);
  const equipment = { ...edit?.equipment };
  colosseumSlotsTouched(sim, target).forEach((touched) => {
    equipment[touched] = target.includes(touched) ? pick : null;
  });
  return colosseumSetupEditHero(released, real, { equipment });
}

// Sim trees respec freely, so learning only needs a free rank and SP.
export function colosseumTreeLearn(
  sim: Character,
  nodeId: SkillTreeNodeId,
): SkillTreeNodeId[] | undefined {
  const canLearn = characterSkillTreeNodeRanks(sim, []).get(nodeId)?.canLearn;
  const learned = characterSkillTreeNodeIds(sim, sim.jobId);
  return canLearn ? [...learned, nodeId] : undefined;
}

// Dropping a node's last rank also drops whatever depended on it.
export function colosseumTreeUnlearn(
  sim: Character,
  nodeId: SkillTreeNodeId,
): SkillTreeNodeId[] {
  const learned = characterSkillTreeNodeIds(sim, sim.jobId);
  const remaining = skillTreeIdsWithoutPresent(learned, [nodeId]);
  return skillTreePrune(sim.jobId, remaining, sim.level);
}
