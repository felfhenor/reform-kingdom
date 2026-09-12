import type * as AnalyticsHelper from '@helpers/engine/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

vi.mock('@helpers/kingdom/armory', () => ({
  armoryAdd: vi.fn(),
}));

vi.mock('@helpers/decree/auto-mode', () => ({
  autoModeRecordClauseFailure: vi.fn(),
  autoModeRecordClauseSuccess: vi.fn(),
  autoModeRecordNodeFailure: vi.fn(),
  autoModeRecordNodeSuccess: vi.fn(),
  autoModeResetNodeFailureCounts: vi.fn(),
}));

vi.mock('@helpers/kingdom/bestiary', () => ({
  monsterRecordKill: vi.fn(),
}));

vi.mock('@helpers/commission/commission-kill-progress', () => ({
  commissionRecordMonsterKill: vi.fn(),
}));

vi.mock('@helpers/hero/character-progress', () => ({
  partyGainXp: vi.fn(),
  syncPartyHpFromCombat: vi.fn(),
}));

vi.mock('@helpers/combat/combat-state', () => ({
  combatReset: vi.fn(),
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/item/collectibles', () => ({
  collectiblesAdd: vi.fn(),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  collectibleDropHtml: vi.fn(),
  combatMessageLog: vi.fn(),
  equipmentDropHtml: vi.fn(),
  ITEM_ICON_TOKEN: '@@icon@@',
  itemDropHtml: vi.fn(),
  recipeDropHtml: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/encounter/encounter', () => ({
  encounterStartFight: vi.fn(),
}));

vi.mock('@helpers/item/loot', () => ({
  rollDroppedRewards: vi.fn(() => []),
}));

vi.mock('@helpers/item/materials', () => ({
  addMaterial: vi.fn(),
}));

vi.mock('@helpers/combat/monster', () => ({
  monsterXpReward: vi.fn(() => 0),
  xpForOverLevel: vi.fn((rawXp: number) => rawXp),
}));

vi.mock('@helpers/crafting/recipes', () => ({
  recipeDiscover: vi.fn(),
}));

vi.mock('@helpers/engine/gather-vfx', () => ({
  gatherVfxEmit: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-rewards', () => ({
  rewardContentInfo: vi.fn(),
}));

vi.mock('@helpers/hero/travel', () => ({
  travelBeginDeathsDoor: vi.fn(),
}));

vi.mock('@helpers/town/raid/town-raid-resolve', () => ({
  raidResolveVictory: vi.fn(),
  raidResolveDefeat: vi.fn(),
}));

import { combatCheckIfOver, isCombatOver } from '@helpers/combat/combat-end';
import {
  collectibleDropHtml,
  recipeDropHtml,
} from '@helpers/combat/combat-log';
import { combatReset } from '@helpers/combat/combat-state';
import { monsterXpReward, xpForOverLevel } from '@helpers/combat/monster';
import { commissionRecordMonsterKill } from '@helpers/commission/commission-kill-progress';
import { getEntry } from '@helpers/content/content';
import { recipeDiscover } from '@helpers/crafting/recipes';
import {
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeRecordNodeFailure,
  autoModeRecordNodeSuccess,
  autoModeResetNodeFailureCounts,
} from '@helpers/decree/auto-mode';
import { encounterStartFight } from '@helpers/encounter/encounter';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { partyGainXp } from '@helpers/hero/character-progress';
import { travelBeginDeathsDoor } from '@helpers/hero/travel';
import { collectiblesAdd } from '@helpers/item/collectibles';
import { rollDroppedRewards } from '@helpers/item/loot';
import { monsterRecordKill } from '@helpers/kingdom/bestiary';
import {
  raidResolveDefeat,
  raidResolveVictory,
} from '@helpers/town/raid/town-raid-resolve';
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
  TownContent,
  TownId,
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
    targetting: [{ type: 'Random' }],
    baseStats: {} as never,
    statBoosts: {} as never,
    totalStats: {} as never,
    combatStats: {} as never,
    resistance: {} as never,
    affinity: {} as never,
    tagResistance: {} as never,
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

function buildCombat(overrides: Partial<Combat>): Combat {
  return {
    id: 'combat-1' as never,
    locationName: 'Field Ruins',
    locationPosition: { x: 0, y: 0 },
    rounds: 1,
    heroes: [buildCombatant({ id: 'hero-1', hp: 10 })],
    helpers: [],
    guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 0 })],
    ...overrides,
  };
}

describe('isCombatOver', () => {
  it('is a loss once every hero is dead, even if a town-guardian helper is still alive', () => {
    const combat = buildCombat({
      heroes: [buildCombatant({ id: 'hero-1', hp: 0 })],
      helpers: [buildCombatant({ id: 'helper-1', hp: 10 })],
      guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 10 })],
    });

    expect(isCombatOver(combat)).toBe(true);
  });

  it('is not over while at least one hero and one guardian are alive, regardless of helpers', () => {
    const combat = buildCombat({
      heroes: [buildCombatant({ id: 'hero-1', hp: 10 })],
      helpers: [buildCombatant({ id: 'helper-1', hp: 0 })],
      guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 10 })],
    });

    expect(isCombatOver(combat)).toBe(false);
  });
});

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

  it('sends a node-completion analytics event with the location name', () => {
    const encounter = {
      fights: [{ monsters: [] }],
      completionRewards: [],
    } as unknown as EncounterContent;
    vi.mocked(getEntry).mockReturnValue(encounter as never);

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
      locationName: 'Field Ruins',
    });

    combatCheckIfOver(combat);

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'World:Node:Complete:Field Ruins',
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
      { kind: 'Collectible', collectibleId: collectible.id },
    ]);
    vi.mocked(collectibleDropHtml).mockReturnValue('Swamp Clam');

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
    });

    combatCheckIfOver(combat);

    expect(collectiblesAdd).toHaveBeenCalledWith(collectible.id, 1);
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
    vi.mocked(rollDroppedRewards).mockReturnValue([
      { kind: 'Recipe', recipeId: recipe.id },
    ]);
    vi.mocked(recipeDropHtml).mockReturnValue('Equipment: Bone-Hewn Cloak');

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
    });

    combatCheckIfOver(combat);

    expect(recipeDiscover).toHaveBeenCalledWith(recipe.id);
  });

  it('resets combat on victory when the combat has no encounter (e.g. a bare fight)', () => {
    const combat = buildCombat({});

    combatCheckIfOver(combat);

    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(combatReset).toHaveBeenCalled();
  });

  it('records an Auto Mode clause and node success on victory', () => {
    const combat = buildCombat({});

    combatCheckIfOver(combat);

    expect(autoModeRecordClauseSuccess).toHaveBeenCalled();
    expect(autoModeRecordClauseFailure).not.toHaveBeenCalled();
    expect(autoModeRecordNodeSuccess).toHaveBeenCalledWith('Field Ruins');
    expect(autoModeRecordNodeFailure).not.toHaveBeenCalled();
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
    expect(autoModeRecordNodeFailure).toHaveBeenCalledWith('Field Ruins');
  });

  it('routes a raid victory to raidResolveVictory instead of the encounter-completion path', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const combat = buildCombat({ raidTownId: 'larsia' });

    const result = combatCheckIfOver(combat);

    expect(result).toBe(true);
    expect(raidResolveVictory).toHaveBeenCalledWith(combat, 'larsia');
    expect(encounterStartFight).not.toHaveBeenCalled();
    expect(combatReset).toHaveBeenCalled();
  });

  it('calls raidResolveDefeat in addition to the normal Deaths Door defeat handling for a raid loss', () => {
    const combat = buildCombat({
      raidTownId: 'larsia',
      heroes: [buildCombatant({ id: 'hero-1', hp: 0 })],
      guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 10 })],
    });

    combatCheckIfOver(combat);

    expect(travelBeginDeathsDoor).toHaveBeenCalled();
    expect(raidResolveDefeat).toHaveBeenCalledWith('larsia');
  });

  it('does not call raidResolveDefeat for a non-raid loss', () => {
    const combat = buildCombat({
      heroes: [buildCombatant({ id: 'hero-1', hp: 0 })],
      guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 10 })],
    });

    combatCheckIfOver(combat);

    expect(raidResolveDefeat).not.toHaveBeenCalled();
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

  it("grants over-level-scaled XP for a raid win, using the town's assaulter max level", () => {
    const monster = { id: 'monster-1' } as MonsterContent;
    const town = {
      id: 'larsia' as TownId,
      defense: { assaulter: { level: { min: 20, max: 25 } } },
    } as TownContent;

    vi.mocked(getEntry).mockImplementation(
      (id) => (id === 'larsia' ? town : monster) as never,
    );
    vi.mocked(monsterXpReward).mockReturnValue(100);
    vi.mocked(xpForOverLevel).mockReturnValue(80);

    const combat = buildCombat({
      raidTownId: 'larsia',
      heroes: [buildCombatant({ id: 'hero-1', level: 22, hp: 10 })],
      guardians: [
        buildCombatant({
          id: 'guardian-1',
          isEnemy: true,
          hp: 0,
          monsterId: 'monster-1',
          level: 25,
        }),
      ],
    });

    combatCheckIfOver(combat);

    expect(xpForOverLevel).toHaveBeenCalledWith(100, 22, 25);
    expect(partyGainXp).toHaveBeenCalledWith(80);
  });

  it('wipes every node failure count when the XP gain levels up the party', () => {
    const monster = { id: 'monster-1' } as MonsterContent;
    const encounter = {
      fights: [{ monsters: [] }],
      completionRewards: [],
      levelRange: { min: 1, max: 1 },
    } as unknown as EncounterContent;

    vi.mocked(getEntry).mockImplementation(
      (id) => (id === 'enc-1' ? encounter : monster) as never,
    );
    vi.mocked(monsterXpReward).mockReturnValue(100);
    vi.mocked(xpForOverLevel).mockReturnValue(100);
    vi.mocked(partyGainXp).mockReturnValue(true);

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
      guardians: [
        buildCombatant({
          id: 'guardian-1',
          isEnemy: true,
          hp: 0,
          monsterId: 'monster-1',
          level: 1,
        }),
      ],
    });

    combatCheckIfOver(combat);

    expect(autoModeResetNodeFailureCounts).toHaveBeenCalled();
  });

  it('leaves node failure counts alone when the XP gain does not level up the party', () => {
    const monster = { id: 'monster-1' } as MonsterContent;
    const encounter = {
      fights: [{ monsters: [] }],
      completionRewards: [],
      levelRange: { min: 1, max: 1 },
    } as unknown as EncounterContent;

    vi.mocked(getEntry).mockImplementation(
      (id) => (id === 'enc-1' ? encounter : monster) as never,
    );
    vi.mocked(monsterXpReward).mockReturnValue(100);
    vi.mocked(xpForOverLevel).mockReturnValue(100);
    vi.mocked(partyGainXp).mockReturnValue(false);

    const combat = buildCombat({
      encounterId: 'enc-1' as EncounterId,
      fightIndex: 0,
      guardians: [
        buildCombatant({
          id: 'guardian-1',
          isEnemy: true,
          hp: 0,
          monsterId: 'monster-1',
          level: 1,
        }),
      ],
    });

    combatCheckIfOver(combat);

    expect(autoModeResetNodeFailureCounts).not.toHaveBeenCalled();
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

    expect(monsterRecordKill).toHaveBeenCalledWith(
      'monster-1',
      5,
      'Field Ruins',
    );
    expect(commissionRecordMonsterKill).toHaveBeenCalledWith('monster-1');
  });

  it('does not record a bestiary kill on defeat', () => {
    const combat = buildCombat({
      heroes: [buildCombatant({ id: 'hero-1', hp: 0 })],
      guardians: [buildCombatant({ id: 'guardian-1', isEnemy: true, hp: 10 })],
    });

    combatCheckIfOver(combat);

    expect(monsterRecordKill).not.toHaveBeenCalled();
    expect(commissionRecordMonsterKill).not.toHaveBeenCalled();
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
