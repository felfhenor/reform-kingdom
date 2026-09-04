import type * as EsToolkitCompat from 'es-toolkit/compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

// sample() picks randomly - mocked so raidAssaulterMonsterIds/raidAssaulterPreview stay deterministic to test.
vi.mock('es-toolkit/compat', async (importOriginal) => {
  const actual = await importOriginal<typeof EsToolkitCompat>();
  return { ...actual, sample: vi.fn() };
});

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

vi.mock('@helpers/town/town-guardian', () => ({
  townGuardiansForCurrentReputation: vi.fn(() => []),
}));

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate } from '@helpers/state-game';
import {
  isTownCraftDebuffActive,
  raidAssaulterMonsterIds,
  raidAssaulterPreview,
  raidDefenderPreview,
  telegraphedRaidTownIds,
  townRaidTelegraph,
} from '@helpers/town/raid/town-raid-state';
import { townGuardiansForCurrentReputation } from '@helpers/town/town-guardian';
import type {
  GameState,
  MonsterContent,
  MonsterId,
  TownContent,
  TownDefenseAssaulterConfig,
  TownId,
  TownNodeState,
} from '@interfaces';
import { sample } from 'es-toolkit/compat';

const townId = 'larsia' as TownId;

function buildTownState(overrides: Partial<TownNodeState> = {}): TownNodeState {
  return {
    lastProcessedTick: {},
    stock: [],
    workers: {},
    reputation: 0,
    hiddenGold: 0,
    materials: {},
    tradeskills: {},
    craftQueue: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntry).mockReturnValue(undefined);
  vi.mocked(townGuardiansForCurrentReputation).mockReturnValue([]);
});

describe('townRaidTelegraph', () => {
  it('returns the telegraph window and the assaulter list rolled at telegraph time', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: buildTownState({
            raidTelegraphedAtTick: 100,
            raidEngageWindowExpiresAtTick: 500,
            raidTelegraphedAssaulterIds: ['larsian-citizen' as MonsterId],
          }),
        },
      },
    } as unknown as GameState);

    expect(townRaidTelegraph(townId)).toEqual({
      telegraphedAtTick: 100,
      engageWindowExpiresAtTick: 500,
      assaulterMonsterIds: ['larsian-citizen' as MonsterId],
    });
  });

  it('defaults the assaulter list to empty when unset (legacy save)', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: buildTownState({
            raidTelegraphedAtTick: 100,
            raidEngageWindowExpiresAtTick: 500,
          }),
        },
      },
    } as unknown as GameState);

    expect(townRaidTelegraph(townId)?.assaulterMonsterIds).toEqual([]);
  });

  it('is undefined when no raid is telegraphed', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: buildTownState() } },
    } as unknown as GameState);

    expect(townRaidTelegraph(townId)).toBeUndefined();
  });

  it('is undefined when the town has no state at all', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(townRaidTelegraph(townId)).toBeUndefined();
  });
});

describe('isTownCraftDebuffActive', () => {
  it('is true while the debuff has not yet expired', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(100);

    expect(
      isTownCraftDebuffActive(
        buildTownState({ craftSpeedDebuffExpiresAtTick: 200 }),
      ),
    ).toBe(true);
  });

  it('is false once the debuff has expired', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(300);

    expect(
      isTownCraftDebuffActive(
        buildTownState({ craftSpeedDebuffExpiresAtTick: 200 }),
      ),
    ).toBe(false);
  });

  it('is false when no debuff is set', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(100);

    expect(isTownCraftDebuffActive(buildTownState())).toBe(false);
  });
});

describe('telegraphedRaidTownIds', () => {
  it('returns only towns currently telegraphing a raid', () => {
    const larsia = { id: 'larsia' as TownId, name: 'Larsia' } as TownContent;
    const other = { id: 'other' as TownId, name: 'Other' } as TownContent;
    vi.mocked(getEntriesByType).mockReturnValue([larsia, other] as never);
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          larsia: buildTownState({
            raidTelegraphedAtTick: 100,
            raidEngageWindowExpiresAtTick: 500,
          }),
          other: buildTownState(),
        },
      },
    } as unknown as GameState);

    expect(telegraphedRaidTownIds()).toEqual(['larsia']);
  });

  it('returns an empty list when nothing is telegraphed', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      { id: 'larsia' as TownId, name: 'Larsia' } as TownContent,
    ] as never);
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { larsia: buildTownState() } },
    } as unknown as GameState);

    expect(telegraphedRaidTownIds()).toEqual([]);
  });
});

const citizenId = 'larsian-citizen' as MonsterId;
const guardId = 'larsian-guard' as MonsterId;

const citizen: MonsterContent = {
  id: citizenId,
  name: 'Larsian Citizen',
} as MonsterContent;
const guard: MonsterContent = {
  id: guardId,
  name: 'Larsian Guard',
} as MonsterContent;

function buildTown(overrides: Partial<TownContent> = {}): TownContent {
  return {
    id: townId,
    name: 'Larsia',
    level: 25,
    defense: {
      rewards: [],
      guardian: { reputationTiers: [] },
      assaulter: { numMonsters: 0, monsterIds: [], level: { min: 1, max: 1 } },
      quests: { commissions: [] },
    },
    ...overrides,
  } as TownContent;
}

describe('raidAssaulterMonsterIds', () => {
  it('draws numMonsters entries, each sampled from monsterIds', () => {
    vi.mocked(sample).mockReturnValue(citizenId);
    const assaulter: TownDefenseAssaulterConfig = {
      numMonsters: 5,
      monsterIds: [citizenId, guardId],
      level: { min: 1, max: 1 },
    };

    const result = raidAssaulterMonsterIds(assaulter);

    expect(result).toHaveLength(5);
    expect(sample).toHaveBeenCalledTimes(5);
    expect(sample).toHaveBeenCalledWith(assaulter.monsterIds);
  });

  it('returns an empty list when no monster ids are authored', () => {
    expect(
      raidAssaulterMonsterIds({
        numMonsters: 5,
        monsterIds: [],
        level: { min: 1, max: 1 },
      }),
    ).toEqual([]);
    expect(sample).not.toHaveBeenCalled();
  });
});

describe('raidAssaulterPreview', () => {
  function mockTelegraphedAssaulters(monsterIds: MonsterId[]) {
    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: buildTownState({
            raidTelegraphedAtTick: 100,
            raidEngageWindowExpiresAtTick: 500,
            raidTelegraphedAssaulterIds: monsterIds,
          }),
        },
      },
    } as unknown as GameState);
  }

  it('counts each distinct monster from the list rolled at telegraph time', () => {
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === citizenId ? citizen : guard) as never,
    );
    mockTelegraphedAssaulters([
      citizenId,
      guardId,
      citizenId,
      guardId,
      citizenId,
    ]);

    expect(raidAssaulterPreview(buildTown())).toEqual([
      { monster: citizen, quantity: 3 },
      { monster: guard, quantity: 2 },
    ]);
  });

  it('skips a monster id that no longer resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    mockTelegraphedAssaulters([citizenId, citizenId]);

    expect(raidAssaulterPreview(buildTown())).toEqual([]);
  });

  it('is empty when no raid is currently telegraphed', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: buildTownState() } },
    } as unknown as GameState);

    expect(raidAssaulterPreview(buildTown())).toEqual([]);
  });
});

describe('raidDefenderPreview', () => {
  it("resolves the town's current-reputation guardian entries to monster content", () => {
    vi.mocked(townGuardiansForCurrentReputation).mockReturnValue([
      { monsterId: citizenId, quantity: 2 },
      { monsterId: guardId, quantity: 1 },
    ]);
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === citizenId ? citizen : guard) as never,
    );

    expect(raidDefenderPreview(buildTown())).toEqual([
      { monster: citizen, quantity: 2 },
      { monster: guard, quantity: 1 },
    ]);
  });

  it('skips a guardian entry whose monster id no longer resolves to content', () => {
    vi.mocked(townGuardiansForCurrentReputation).mockReturnValue([
      { monsterId: citizenId, quantity: 2 },
    ]);
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(raidDefenderPreview(buildTown())).toEqual([]);
  });
});
