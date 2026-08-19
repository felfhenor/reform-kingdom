import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat-damage', () => ({
  combatApplySkillToTarget: vi.fn(),
  combatCombatantTakeDamage: vi.fn(),
}));

vi.mock('@helpers/combat-end', () => ({
  combatantIsDead: vi.fn(() => false),
  combatCheckIfOver: vi.fn(),
  combatHandleDefeat: vi.fn(),
  isCombatOver: vi.fn(() => false),
}));

vi.mock('@helpers/combat-log', () => ({
  beginCombatLogCommits: vi.fn(),
  combatMessageLog: vi.fn(),
  endCombatLogCommits: vi.fn(),
}));

vi.mock('@helpers/combat-order-evaluation', () => ({
  pickSkillFromCombatOrders: vi.fn(),
}));

vi.mock('@helpers/combat-statuseffects', () => ({
  combatCanTakeTurn: vi.fn(() => true),
  combatHandleCombatantStatusEffects: vi.fn(),
  combatUnapplyAllStatusEffects: vi.fn(),
}));

vi.mock('@helpers/combat-stats', () => ({
  combatCombatantCombatStatSucceedsChance: vi.fn(() => false),
  combatCombatantCombatStatValue: vi.fn(() => 0),
}));

vi.mock('@helpers/combat-targetting', () => ({
  combatAvailableSkillsForCombatant: vi.fn(),
  combatGetPossibleCombatantTargetsForSkill: vi.fn(() => [{ id: 'target' }]),
  combatGetPossibleCombatantTargetsForSkillTechnique: vi.fn(() => []),
  combatGetTargetsFromListBasedOnType: vi.fn(() => []),
}));

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
  rngSucceedsChance: vi.fn(() => false),
  rngUuid: vi.fn(() => 'uuid'),
}));

vi.mock('@helpers/skill', () => ({
  skillEpCost: vi.fn(() => 0),
  skillTechniqueNumTargets: vi.fn(() => 1),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { combatantTakeTurn } from '@helpers/combat';
import { combatantSkillCastEvents } from '@helpers/combat-skill-events';
import { pickSkillFromCombatOrders } from '@helpers/combat-order-evaluation';
import { combatAvailableSkillsForCombatant } from '@helpers/combat-targetting';
import { rngChoiceWeighted } from '@helpers/rng';
import type {
  Combat,
  Combatant,
  CombatOrderClauseId,
  EquipmentSkill,
} from '@interfaces';

function buildCombat(): Combat {
  return {
    id: 'combat-1' as never,
    locationName: 'Field Ruins',
    locationPosition: { x: 0, y: 0 },
    rounds: 1,
    heroes: [],
    guardians: [],
  };
}

function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'combatant-1',
    name: 'Combatant',
    isEnemy: false,
    level: 1,
    hp: 100,
    ep: 10,
    sprite: '0000',
    frames: 4,
    targettingType: 'Random',
    baseStats: {} as never,
    statBoosts: {} as never,
    totalStats: { Health: 100, Energy: 10 } as never,
    combatStats: {} as never,
    resistance: {} as never,
    affinity: {} as never,
    skillIds: [],
    skillRefs: [],
    skillWeights: {},
    combatOrders: [],
    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
    ...overrides,
  };
}

function buildSkill(overrides: Partial<EquipmentSkill> = {}): EquipmentSkill {
  return {
    id: 'skill-1' as never,
    name: 'Test Skill',
    __type: 'skill',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    epCost: 0,
    usesPerCombat: -1,
    statusEffectDurationBoost: {} as never,
    statusEffectChanceBoost: {} as never,
    techniques: [],
    requiredWeaponTypes: [],
    family: 'Test Skill',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  combatantSkillCastEvents.set([]);
});

describe('combatantTakeTurn skill selection', () => {
  it('emits a skill-cast event for the chosen skill', () => {
    const weightedSkill = buildSkill({
      id: 'weighted' as never,
      name: 'Fireball',
      sprite: '0042',
    });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      weightedSkill,
    ]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);

    const combatant = buildCombatant({ id: 'caster-1', combatOrders: [] });

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatantSkillCastEvents()).toMatchObject([
      { combatantId: 'caster-1', skillName: 'Fireball', skillSprite: '0042' },
    ]);
  });

  it('uses the Combat Orders pick when the hero has configured orders', () => {
    const orderedSkill = buildSkill({
      id: 'ordered' as never,
      family: 'Fireball',
    });
    const weightedSkill = buildSkill({ id: 'weighted' as never });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      orderedSkill,
      weightedSkill,
    ]);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: orderedSkill,
    });
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);

    const combatant = buildCombatant({
      combatOrders: [
        {
          id: 'clause-1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    combatantTakeTurn(buildCombat(), combatant);

    expect(combatant.skillUses['ordered' as never]).toBe(1);
    expect(combatant.skillUses['weighted' as never]).toBeUndefined();
  });

  it('falls back to weighted-random and never consults Combat Orders when none are configured', () => {
    const weightedSkill = buildSkill({ id: 'weighted' as never });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      weightedSkill,
    ]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);

    const combatant = buildCombatant({ combatOrders: [] });

    combatantTakeTurn(buildCombat(), combatant);

    expect(pickSkillFromCombatOrders).not.toHaveBeenCalled();
    expect(combatant.skillUses['weighted' as never]).toBe(1);
  });

  it('enemies always use weighted-random, even if combatOrders were somehow populated', () => {
    const weightedSkill = buildSkill({ id: 'weighted' as never });
    const orderedSkill = buildSkill({ id: 'ordered' as never });

    vi.mocked(combatAvailableSkillsForCombatant).mockReturnValue([
      weightedSkill,
    ]);
    vi.mocked(rngChoiceWeighted).mockReturnValue(weightedSkill);
    vi.mocked(pickSkillFromCombatOrders).mockReturnValue({
      skill: orderedSkill,
    });

    const combatant = buildCombatant({
      isEnemy: true,
      combatOrders: [
        {
          id: 'clause-1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'RandomSkill' },
        },
      ],
    });

    combatantTakeTurn(buildCombat(), combatant);

    expect(pickSkillFromCombatOrders).not.toHaveBeenCalled();
    expect(combatant.skillUses['weighted' as never]).toBe(1);
  });
});
