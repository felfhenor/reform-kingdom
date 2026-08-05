import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  armoryAdd: vi.fn(),
}));

vi.mock('@helpers/combat', () => ({
  combatReset: vi.fn(),
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/combat-log', () => ({
  combatMessageLog: vi.fn(),
  equipmentDropHtml: vi.fn(),
  itemDropHtml: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/encounter', () => ({
  encounterStartFight: vi.fn(),
}));

vi.mock('@helpers/loot', () => ({
  rollDroppedRewards: vi.fn(() => []),
}));

vi.mock('@helpers/materials', () => ({
  addMaterial: vi.fn(),
}));

vi.mock('@helpers/monster', () => ({
  monsterXpReward: vi.fn(() => 0),
}));

vi.mock('@helpers/party', () => ({
  partyGainXp: vi.fn(),
  syncPartyHpFromCombat: vi.fn(),
}));

vi.mock('@helpers/travel', () => ({
  travelBeginDeathsDoor: vi.fn(),
}));

import { combatReset } from '@helpers/combat';
import { combatCheckIfOver } from '@helpers/combat-end';
import { getEntry } from '@helpers/content';
import { encounterStartFight } from '@helpers/encounter';
import { rollDroppedRewards } from '@helpers/loot';
import { travelBeginDeathsDoor } from '@helpers/travel';
import type {
  Combat,
  Combatant,
  EncounterContent,
  EncounterId,
} from '@interfaces';

function buildCombatant(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'combatant-1',
    name: 'Combatant',
    isEnemy: false,
    level: 1,
    hp: 10,
    sprite: '0000',
    frames: 4,
    targettingType: 'Random',
    baseStats: {} as never,
    statBoosts: {} as never,
    totalStats: {} as never,
    combatStats: {} as never,
    resistance: {} as never,
    affinity: {} as never,
    skillIds: [],
    skillRefs: [],
    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
    ...overrides,
  };
}

function buildCombat(overrides: Partial<Combat>): Combat {
  return {
    id: 'combat-1' as never,
    locationName: 'Field Ruins',
    locationPosition: { x: 0, y: 0 },
    rounds: 1,
    heroes: [buildCombatant({ id: 'hero-1', hp: 10 })],
    guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 0 })],
    elementalModifiers: {} as never,
    ...overrides,
  };
}

describe('combatCheckIfOver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts the next fight and does not reset combat when the encounter has more fights', () => {
    const encounter = {
      fights: [{ monsters: [] }, { monsters: [] }],
    } as unknown as EncounterContent;
    vi.mocked(getEntry).mockReturnValue(encounter as never);

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
    });

    const result = combatCheckIfOver(combat);

    expect(result).toBe(true);
    expect(encounterStartFight).toHaveBeenCalledWith(
      'enc-1',
      1,
      'Field Ruins',
    );
    expect(combatReset).not.toHaveBeenCalled();
    // Mid-encounter: no completion rewards roll yet (there are also no
    // resolvable monsters in this fixture, so no kill-drop roll either).
    expect(rollDroppedRewards).not.toHaveBeenCalled();
  });

  it('resets combat on victory when there is no next fight', () => {
    const encounter = {
      fights: [{ monsters: [] }],
      completionRewards: [{ itemId: 'gold' }],
    } as unknown as EncounterContent;
    vi.mocked(getEntry).mockReturnValue(encounter as never);

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
    });

    combatCheckIfOver(combat);

    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(combatReset).toHaveBeenCalled();
    // The node is fully cleared - completion rewards roll exactly once,
    // scaled to the concluding fight's guardian level.
    expect(rollDroppedRewards).toHaveBeenCalledTimes(1);
    expect(rollDroppedRewards).toHaveBeenCalledWith(
      encounter.completionRewards,
      1,
    );
  });

  it('resets combat on victory when the combat has no encounter (e.g. a bare fight)', () => {
    const combat = buildCombat({});

    combatCheckIfOver(combat);

    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(combatReset).toHaveBeenCalled();
  });

  it('begins Deaths Door and resets combat on defeat', () => {
    const combat = buildCombat({
      heroes: [buildCombatant({ id: 'hero-1', hp: 0 })],
      guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 10 })],
    });

    combatCheckIfOver(combat);

    expect(travelBeginDeathsDoor).toHaveBeenCalled();
    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(combatReset).toHaveBeenCalled();
  });

  it('returns false when combat is not yet over', () => {
    const combat = buildCombat({
      heroes: [buildCombatant({ id: 'hero-1', hp: 10 })],
      guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 10 })],
    });

    expect(combatCheckIfOver(combat)).toBe(false);
    expect(combatReset).not.toHaveBeenCalled();
  });
});
