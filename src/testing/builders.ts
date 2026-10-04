import {
  combatantFromCharacter,
  combatantFromMonster,
  combatCreateForEncounter,
} from '@helpers/combat/combat-create';
import { ensureSkill } from '@helpers/content/ensure-skill';
import { ensureStatusEffect } from '@helpers/content/ensure-statuseffect';
import { defaultStats } from '@helpers/defaults';
import {
  characterStatsForLevel,
  characterXpForLevel,
  createCharacter,
} from '@helpers/hero/party';
import { newEquipmentItem } from '@helpers/item/equipment';
import { characterAllTeachingIds } from '@helpers/trainer/trainer-teaching';
import type {
  CaravanNodeState,
  Character,
  Combat,
  Combatant,
  CommissionNodeState,
  CraftQueueEntry,
  CraftQueueEntryId,
  EquipmentId,
  EquipmentItem,
  EquipmentSkill,
  JobId,
  MonsterContent,
  RecipeId,
  StatusEffect,
  TownCraftQueueEntry,
  TownNodeState,
  TownStockEntry,
  TradeskillId,
} from '@interfaces';

export function buildTownNodeState(
  overrides: Partial<TownNodeState> = {},
): TownNodeState {
  return {
    lastProcessedTick: {},
    stock: [],
    workers: {},
    reputation: 0,
    hiddenGold: 0,
    materials: {},
    tradeskills: {},
    craftQueue: [],
    commissionSlots: [],
    specialtyPriority: [],
    ...overrides,
  };
}

export function buildCaravanNodeState(
  overrides: Partial<CaravanNodeState> = {},
): CaravanNodeState {
  return {
    activeTradeIndices: [],
    tradeCounts: {},
    generatedAtTick: 0,
    ...overrides,
  };
}

export function buildCommissionNodeState(
  overrides: Partial<CommissionNodeState> = {},
): CommissionNodeState {
  return {
    requirements: [],
    completed: false,
    generatedAt: 0,
    ...overrides,
  };
}

export function buildCraftQueueEntry(
  overrides: Partial<CraftQueueEntry> & { recipeId: RecipeId },
): CraftQueueEntry {
  return {
    id: `queue-${overrides.recipeId}` as CraftQueueEntryId,
    quantityTotal: 1,
    quantityCompleted: 0,
    ticksIntoCraft: 0,
    reservedEquipment: [],
    ...overrides,
  };
}

export function buildTownCraftQueueEntry(
  overrides: Partial<TownCraftQueueEntry> & { recipeId: RecipeId },
): TownCraftQueueEntry {
  return {
    id: `town-queue-${overrides.recipeId}` as CraftQueueEntryId,
    tradeskillId: 'test-tradeskill' as TradeskillId,
    ticksIntoCraft: 0,
    ...overrides,
  };
}

export function buildTownStockEntry(
  equipmentId: EquipmentId,
  addedAtTick = 0,
): TownStockEntry {
  return { equipmentItem: buildEquipmentItem(equipmentId), addedAtTick };
}

export function buildEquipmentItem(
  equipmentId: EquipmentId,
  overrides: Partial<EquipmentItem> = {},
): EquipmentItem {
  return { ...newEquipmentItem(equipmentId, []), ...overrides };
}

// Stats, pools and xp follow the requested level/job/equipment/teachings unless overridden explicitly.
export function buildCharacter(overrides: Partial<Character> = {}): Character {
  // Not 'UNKNOWN': that's the id/name ensureX() gives unnamed content, so the job lookup could hit it.
  const base = createCharacter(
    'Hero',
    overrides.jobId ?? ('test-job-without-content' as JobId),
  );
  const level = overrides.level ?? base.level;
  const stats = characterStatsForLevel(
    base.jobId,
    level,
    overrides.equipment ?? base.equipment,
    characterAllTeachingIds({ teachings: overrides.teachings ?? {} }),
  );

  return {
    ...base,
    level,
    stats,
    hp: stats.Health,
    ep: stats.Energy,
    xp: { current: 0, maximum: characterXpForLevel(level) },
    ...overrides,
  };
}

export function buildHeroCombatant(
  character: Character = buildCharacter(),
  overrides: Partial<Combatant> = {},
): Combatant {
  return { ...combatantFromCharacter(character), ...overrides };
}

export function buildMonsterCombatant(
  monster: MonsterContent,
  overrides: Partial<Combatant> = {},
): Combatant {
  return {
    ...combatantFromMonster(monster, overrides.level ?? 1, 0),
    ...overrides,
  };
}

// No job skills, and 100 Health/Energy so hp and ep read directly as percentages.
export function buildTestCombatant(
  overrides: Partial<Combatant> = {},
): Combatant {
  return buildHeroCombatant(buildCharacter(), {
    id: 'combatant-1',
    skillIds: [],
    hp: 100,
    ep: 10,
    totalStats: { ...defaultStats(), Health: 100, Energy: 100 },
    ...overrides,
  });
}

export function buildCombat(overrides: Partial<Combat> = {}): Combat {
  return { ...combatCreateForEncounter([], [], 1), ...overrides };
}

export function buildEquipmentSkill(
  overrides: Partial<EquipmentSkill> = {},
): EquipmentSkill {
  return { ...ensureSkill(overrides), mods: overrides.mods };
}

export function buildStatusEffect(
  overrides: Partial<StatusEffect> = {},
): StatusEffect {
  return {
    ...ensureStatusEffect(overrides),
    duration: overrides.duration ?? 1,
    creatorStats: overrides.creatorStats ?? defaultStats(),
    targetStats: overrides.targetStats ?? defaultStats(),
  };
}
