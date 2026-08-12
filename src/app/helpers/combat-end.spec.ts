import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  armoryAdd: vi.fn(),
}));

vi.mock('@helpers/auto-mode', () => ({
  autoModeRecordClauseFailure: vi.fn(),
  autoModeRecordClauseSuccess: vi.fn(),
}));

vi.mock('@helpers/bestiary', () => ({
  monsterRecordKill: vi.fn(),
}));

vi.mock('@helpers/combat', () => ({
  combatReset: vi.fn(),
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/collectibles', () => ({
  collectiblesAdd: vi.fn(),
}));

vi.mock('@helpers/combat-log', () => ({
  collectibleDropHtml: vi.fn(),
  combatMessageLog: vi.fn(),
  equipmentDropHtml: vi.fn(),
  itemDropHtml: vi.fn(),
  recipeDropHtml: vi.fn(),
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
  xpForOverLevel: vi.fn((rawXp: number) => rawXp),
}));

vi.mock('@helpers/party', () => ({
  partyGainXp: vi.fn(),
  syncPartyHpFromCombat: vi.fn(),
}));

vi.mock('@helpers/recipes', () => ({
  recipeDiscover: vi.fn(),
}));

vi.mock('@helpers/travel', () => ({
  travelBeginDeathsDoor: vi.fn(),
}));

import {
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
} from '@helpers/auto-mode';
import { monsterRecordKill } from '@helpers/bestiary';
import { collectiblesAdd } from '@helpers/collectibles';
import { combatReset } from '@helpers/combat';
import { combatCheckIfOver } from '@helpers/combat-end';
import { collectibleDropHtml, recipeDropHtml } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import { encounterStartFight } from '@helpers/encounter';
import { rollDroppedRewards } from '@helpers/loot';
import { monsterXpReward, xpForOverLevel } from '@helpers/monster';
import { partyGainXp } from '@helpers/party';
import { recipeDiscover } from '@helpers/recipes';
import { travelBeginDeathsDoor } from '@helpers/travel';
import type {
  CollectibleContent,
  CollectibleId,
  Combat,
  Combatant,
  EncounterContent,
  EncounterId,
  MonsterContent,
  RecipeContent,
  RecipeId,
} from '@interfaces';

function buildCombatant(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'combatant-1',
    name: 'Combatant',
    isEnemy: false,
    level: 1,
    hp: 10,
    ep: 10,
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
    skillWeights: {},
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
    expect(encounterStartFight).toHaveBeenCalledWith('enc-1', 1, 'Field Ruins');
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

  it('grants a rolled collectible completion reward and logs it', () => {
    const collectible = {
      id: 'swamp-clam' as CollectibleId,
      name: 'Swamp Clam',
    } as CollectibleContent;
    const encounter = {
      fights: [{ monsters: [] }],
      completionRewards: [{ collectibleId: collectible.id }],
    } as unknown as EncounterContent;

    vi.mocked(getEntry).mockImplementation(
      (id) => (id === 'enc-1' ? encounter : collectible) as never,
    );
    vi.mocked(rollDroppedRewards).mockReturnValue([
      { collectibleId: collectible.id },
    ]);
    vi.mocked(collectibleDropHtml).mockReturnValue('Swamp Clam');

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
    });

    combatCheckIfOver(combat);

    expect(collectiblesAdd).toHaveBeenCalledWith(
      collectible.id,
      1,
      'Field Ruins',
    );
  });

  it('grants a rolled recipe completion reward and logs it', () => {
    const recipe = {
      id: 'equipment-bone-hewn-cloak' as RecipeId,
      name: 'Equipment: Bone-Hewn Cloak',
    } as RecipeContent;
    const encounter = {
      fights: [{ monsters: [] }],
      completionRewards: [{ recipeId: recipe.id }],
    } as unknown as EncounterContent;

    vi.mocked(getEntry).mockImplementation(
      (id) => (id === 'enc-1' ? encounter : recipe) as never,
    );
    vi.mocked(rollDroppedRewards).mockReturnValue([{ recipeId: recipe.id }]);
    vi.mocked(recipeDropHtml).mockReturnValue('Equipment: Bone-Hewn Cloak');

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
    });

    combatCheckIfOver(combat);

    expect(recipeDiscover).toHaveBeenCalledWith(recipe.id, 'Field Ruins');
  });

  it('resets combat on victory when the combat has no encounter (e.g. a bare fight)', () => {
    const combat = buildCombat({});

    combatCheckIfOver(combat);

    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(combatReset).toHaveBeenCalled();
  });

  it('records an Auto Mode clause success on victory', () => {
    const combat = buildCombat({});

    combatCheckIfOver(combat);

    expect(autoModeRecordClauseSuccess).toHaveBeenCalled();
    expect(autoModeRecordClauseFailure).not.toHaveBeenCalled();
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
    expect(autoModeRecordClauseFailure).toHaveBeenCalled();
  });

  it('degrades XP via xpForOverLevel using the encounter max and highest hero level', () => {
    const monster = { id: 'monster-1' } as MonsterContent;
    const encounter = {
      fights: [{ monsters: [] }],
      completionRewards: [],
      levelRange: { min: 3, max: 5 },
    } as unknown as EncounterContent;

    vi.mocked(getEntry).mockImplementation(
      (id) => (id === 'enc-1' ? encounter : monster) as never,
    );
    vi.mocked(monsterXpReward).mockReturnValue(100);
    vi.mocked(xpForOverLevel).mockReturnValue(50);

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
      heroes: [
        buildCombatant({ id: 'hero-1', level: 4, hp: 10 }),
        buildCombatant({ id: 'hero-2', level: 7, hp: 10 }),
      ],
      guardians: [
        buildCombatant({
          id: 'guardian-1',
          isEnemy: true,
          hp: 0,
          monsterId: 'monster-1',
          level: 5,
        }),
      ],
    });

    combatCheckIfOver(combat);

    // Uses the highest hero level (7) against the node's max (5).
    expect(xpForOverLevel).toHaveBeenCalledWith(100, 7, 5);
    expect(partyGainXp).toHaveBeenCalledWith(50);
  });

  it('records a bestiary kill for each defeated guardian on victory', () => {
    const monster = { id: 'monster-1' } as MonsterContent;
    const encounter = {
      fights: [{ monsters: [] }],
      completionRewards: [],
      levelRange: { min: 3, max: 5 },
    } as unknown as EncounterContent;

    vi.mocked(getEntry).mockImplementation(
      (id) => (id === 'enc-1' ? encounter : monster) as never,
    );

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
      locationName: 'Field Ruins',
      guardians: [
        buildCombatant({
          id: 'guardian-1',
          isEnemy: true,
          hp: 0,
          monsterId: 'monster-1',
          level: 5,
        }),
      ],
    });

    combatCheckIfOver(combat);

    expect(monsterRecordKill).toHaveBeenCalledWith('monster-1', 5, 'Field Ruins');
  });

  it('does not record a bestiary kill on defeat', () => {
    const combat = buildCombat({
      heroes: [buildCombatant({ id: 'hero-1', hp: 0 })],
      guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 10 })],
    });

    combatCheckIfOver(combat);

    expect(monsterRecordKill).not.toHaveBeenCalled();
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
