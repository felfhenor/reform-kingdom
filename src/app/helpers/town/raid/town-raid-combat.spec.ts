import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-create', () => ({
  combatantsFromTownGuardians: vi.fn(() => []),
  combatCreateForEncounter: vi.fn(),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  combatMessageLog: vi.fn(),
}));

vi.mock('@helpers/combat/combat-state', () => ({
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: vi.fn((name: string) => name),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(() => 1000),
}));

vi.mock('@helpers/hero/party', () => ({
  partyGet: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/raid/town-raid-defense', () => ({
  raidDefenseGlobalEffectApply: vi.fn(),
}));

vi.mock('@helpers/town/town-guardian', () => ({
  townGuardiansForCurrentReputation: vi.fn(() => []),
}));

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(),
}));

import {
  combatantsFromTownGuardians,
  combatCreateForEncounter,
} from '@helpers/combat/combat-create';
import { combatMessageLog } from '@helpers/combat/combat-log';
import { currentCombat } from '@helpers/combat/combat-state';
import { getEntry } from '@helpers/content/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { raidEngageCombat } from '@helpers/town/raid/town-raid-combat';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import type {
  Combat,
  GameState,
  MonsterContent,
  MonsterId,
  TownContent,
  TownId,
} from '@interfaces';

const townId = 'larsia' as TownId;

function buildTown(overrides: Partial<TownContent> = {}): TownContent {
  return {
    id: townId,
    name: 'Larsia',
    level: 25,
    defense: {
      rewards: [],
      guardian: { reputationTiers: [] },
      assaulter: {
        numMonsters: 2,
        monsterIds: ['Bloodmoth' as MonsterId],
        level: { min: 20, max: 25 },
      },
      quests: { commissions: [] },
    },
    ...overrides,
  } as TownContent;
}

function mockTownState(
  raidTelegraphedAtTick: number | undefined,
  raidTelegraphedAssaulterIds: MonsterId[] = [],
) {
  vi.mocked(gamestate).mockReturnValue({
    world: {
      towns: {
        [townId]: { raidTelegraphedAtTick, raidTelegraphedAssaulterIds },
      },
    },
  } as unknown as GameState);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentCombat).mockReturnValue(undefined);
  vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
    nodeName: 'Larsia',
  } as never);
  vi.mocked(combatCreateForEncounter).mockReturnValue({
    id: 'combat-1',
    heroes: [],
    helpers: [],
    guardians: [],
  } as unknown as Combat);
});

describe('raidEngageCombat', () => {
  it('returns false when the town does not resolve', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(raidEngageCombat(townId)).toBe(false);
  });

  it('returns false when combat is already in progress', () => {
    vi.mocked(getEntry).mockReturnValue(buildTown() as never);
    vi.mocked(currentCombat).mockReturnValue({} as Combat);

    expect(raidEngageCombat(townId)).toBe(false);
  });

  it('returns false when no raid is telegraphed', () => {
    vi.mocked(getEntry).mockReturnValue(buildTown() as never);
    mockTownState(undefined);

    expect(raidEngageCombat(townId)).toBe(false);
  });

  it('returns false when the party is not standing at the town', () => {
    vi.mocked(getEntry).mockReturnValue(buildTown() as never);
    mockTownState(100);
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: 'Somewhere Else',
    } as never);

    expect(raidEngageCombat(townId)).toBe(false);
  });

  it('returns false when the telegraphed assaulter list is empty', () => {
    vi.mocked(getEntry).mockReturnValue(buildTown() as never);
    mockTownState(100, []);

    expect(raidEngageCombat(townId)).toBe(false);
  });

  it('returns false when every telegraphed monster id fails to resolve to content', () => {
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === townId ? buildTown() : undefined) as never,
    );
    mockTownState(100, ['Bloodmoth' as MonsterId]);

    expect(raidEngageCombat(townId)).toBe(false);
  });

  it('starts the raid combat using the list rolled at telegraph time, and clears the telegraph on success', () => {
    const monster = { id: 'Bloodmoth' as MonsterId } as MonsterContent;
    vi.mocked(getEntry).mockImplementation((id) => {
      if (id === townId) return buildTown() as never;
      return monster as never;
    });
    mockTownState(100, ['Bloodmoth' as MonsterId, 'Bloodmoth' as MonsterId]);

    expect(raidEngageCombat(townId)).toBe(true);

    expect(combatCreateForEncounter).toHaveBeenCalledWith(
      [],
      [monster, monster],
      25,
      'Larsia',
      [],
    );
    expect(combatantsFromTownGuardians).toHaveBeenCalled();
    expect(combatMessageLog).toHaveBeenCalled();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        combat: undefined,
        towns: {
          [townId]: {
            raidTelegraphedAtTick: 100,
            raidEngageWindowExpiresAtTick: 500,
            raidTelegraphedAssaulterIds: ['Bloodmoth' as MonsterId],
          },
        },
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(result.world.combat?.raidTownId).toBe(townId);
    expect(result.world.towns[townId].raidTelegraphedAtTick).toBeUndefined();
    expect(
      result.world.towns[townId].raidEngageWindowExpiresAtTick,
    ).toBeUndefined();
    expect(
      result.world.towns[townId].raidTelegraphedAssaulterIds,
    ).toBeUndefined();
  });
});
