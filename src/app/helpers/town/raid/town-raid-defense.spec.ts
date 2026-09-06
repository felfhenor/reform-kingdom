import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(() => []),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(),
  formatDuration: vi.fn((ticks: number) => `${ticks}t`),
}));

vi.mock('@helpers/hero/global-effect-state', () => ({
  applyGlobalEffectRemove: vi.fn(),
}));

vi.mock('@helpers/hero/travel', () => ({
  canPartyTravel: vi.fn(() => true),
  travelEtaSecondsTo: vi.fn(() => undefined),
}));

vi.mock('@helpers/town/raid/town-raid-state', () => ({
  raidAssaulterPreview: vi.fn(() => []),
  raidDefenderPreview: vi.fn(() => []),
  telegraphedRaidTownIds: vi.fn(() => []),
  townRaidTelegraph: vi.fn(),
}));

vi.mock('@helpers/town/town-visit', () => ({
  isPartyAtTown: vi.fn(() => false),
}));

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { applyGlobalEffectRemove } from '@helpers/hero/global-effect-state';
import { canPartyTravel, travelEtaSecondsTo } from '@helpers/hero/travel';
import {
  raidDefenseGlobalEffectApply,
  raidDefenseRowViewModels,
} from '@helpers/town/raid/town-raid-defense';
import {
  raidAssaulterPreview,
  raidDefenderPreview,
  telegraphedRaidTownIds,
  townRaidTelegraph,
} from '@helpers/town/raid/town-raid-state';
import { isPartyAtTown } from '@helpers/town/town-visit';
import type {
  GameState,
  GlobalEffectContent,
  GlobalEffectId,
  TownContent,
  TownId,
  TownNodeState,
} from '@interfaces';

const larsiaId = 'larsia' as TownId;
const otherId = 'other' as TownId;

function buildTown(id: TownId, name: string): TownContent {
  return { id, name } as TownContent;
}

function buildTownState(
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(timerTicksElapsed).mockReturnValue(1000);
  vi.mocked(canPartyTravel).mockReturnValue(true);
  vi.mocked(travelEtaSecondsTo).mockReturnValue(undefined);
  vi.mocked(isPartyAtTown).mockReturnValue(false);
  vi.mocked(raidAssaulterPreview).mockReturnValue([]);
  vi.mocked(raidDefenderPreview).mockReturnValue([]);
  vi.mocked(telegraphedRaidTownIds).mockReturnValue([]);
  vi.mocked(townRaidTelegraph).mockReturnValue(undefined);
  vi.mocked(getEntriesByType).mockReturnValue([]);
  vi.mocked(getEntry).mockReturnValue(undefined);
});

describe('raidDefenseRowViewModels', () => {
  it('builds one row per telegraphed town, soonest engage-window expiry first', () => {
    vi.mocked(telegraphedRaidTownIds).mockReturnValue([larsiaId, otherId]);
    vi.mocked(getEntry).mockImplementation(
      (id) =>
        (id === larsiaId
          ? buildTown(larsiaId, 'Larsia')
          : buildTown(otherId, 'Other')) as never,
    );
    vi.mocked(townRaidTelegraph).mockImplementation((id) =>
      id === larsiaId
        ? {
            telegraphedAtTick: 900,
            engageWindowExpiresAtTick: 2000,
            assaulterMonsterIds: [],
          }
        : {
            telegraphedAtTick: 900,
            engageWindowExpiresAtTick: 1200,
            assaulterMonsterIds: [],
          },
    );

    const rows = raidDefenseRowViewModels();

    expect(rows.map((row) => row.townId)).toEqual([otherId, larsiaId]);
    expect(rows[0].ticksUntilResolve).toBe(200);
    expect(rows[0].remainingLabel).toBe('200t');
  });

  it('skips a town id that no longer resolves to content', () => {
    vi.mocked(telegraphedRaidTownIds).mockReturnValue([larsiaId]);
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(raidDefenseRowViewModels()).toEqual([]);
  });

  it('skips a town whose telegraph resolved away between the two reads', () => {
    vi.mocked(telegraphedRaidTownIds).mockReturnValue([larsiaId]);
    vi.mocked(getEntry).mockReturnValue(buildTown(larsiaId, 'Larsia') as never);
    vi.mocked(townRaidTelegraph).mockReturnValue(undefined);

    expect(raidDefenseRowViewModels()).toEqual([]);
  });

  it('carries through travel/party-presence state for each row', () => {
    vi.mocked(telegraphedRaidTownIds).mockReturnValue([larsiaId]);
    vi.mocked(getEntry).mockReturnValue(buildTown(larsiaId, 'Larsia') as never);
    vi.mocked(townRaidTelegraph).mockReturnValue({
      telegraphedAtTick: 900,
      engageWindowExpiresAtTick: 1500,
      assaulterMonsterIds: [],
    });
    vi.mocked(isPartyAtTown).mockReturnValue(true);
    vi.mocked(canPartyTravel).mockReturnValue(false);
    vi.mocked(travelEtaSecondsTo).mockReturnValue(42);

    const [row] = raidDefenseRowViewModels();

    expect(row.nodeName).toBe('Larsia');
    expect(row.isPartyHere).toBe(true);
    expect(row.canTravel).toBe(false);
    expect(row.travelEtaSeconds).toBe(42);
  });
});

describe('raidDefenseGlobalEffectApply', () => {
  const effectContent = {
    id: 'raid-defense-requested' as GlobalEffectId,
    __type: 'globaleffect',
    name: 'Raid Defense Requested',
    sprite: '0011',
    description: 'desc',
    effects: [],
  } as GlobalEffectContent;

  function buildState(towns: Record<string, TownNodeState>): GameState {
    return {
      world: { towns },
      globalEffects: [],
    } as unknown as GameState;
  }

  it('removes the effect and adds nothing when no town is telegraphed', () => {
    const state = buildState({ [larsiaId]: buildTownState() });

    raidDefenseGlobalEffectApply(state, 1000);

    expect(applyGlobalEffectRemove).toHaveBeenCalledWith(
      state,
      'Raid Defense Requested' as GlobalEffectId,
    );
    expect(state.globalEffects).toEqual([]);
  });

  it('adds a fresh effect listing every telegraphed town by name, comma-joined', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown(larsiaId, 'Larsia'),
      buildTown(otherId, 'Other'),
    ] as never);
    vi.mocked(getEntry).mockImplementation((id) => {
      if (id === larsiaId) return buildTown(larsiaId, 'Larsia') as never;
      if (id === otherId) return buildTown(otherId, 'Other') as never;
      return effectContent as never;
    });
    const state = buildState({
      [larsiaId]: buildTownState({
        raidTelegraphedAtTick: 900,
        raidEngageWindowExpiresAtTick: 2000,
      }),
      [otherId]: buildTownState({
        raidTelegraphedAtTick: 900,
        raidEngageWindowExpiresAtTick: 1200,
      }),
    });

    raidDefenseGlobalEffectApply(state, 1000);

    expect(state.globalEffects).toHaveLength(1);
    expect(state.globalEffects[0]).toMatchObject({
      id: effectContent.id,
      extendedDescription: 'Larsia, Other',
      startTick: 1000,
    });
  });

  it('ignores a town with content but no telegraph, and skips one telegraphed but no longer resolving to content', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown(larsiaId, 'Larsia'),
      buildTown(otherId, 'Other'),
    ] as never);
    vi.mocked(getEntry).mockImplementation((id) => {
      if (id === larsiaId) return buildTown(larsiaId, 'Larsia') as never;
      if (id === otherId) return undefined;
      return effectContent as never;
    });
    const state = buildState({
      [larsiaId]: buildTownState({
        raidTelegraphedAtTick: 900,
        raidEngageWindowExpiresAtTick: 2000,
      }),
      [otherId]: buildTownState({
        raidTelegraphedAtTick: 900,
        raidEngageWindowExpiresAtTick: 1200,
      }),
    });

    raidDefenseGlobalEffectApply(state, 1000);

    expect(state.globalEffects[0].extendedDescription).toBe('Larsia');
  });

  it('adds nothing when a town is telegraphed but the effect content itself is missing', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown(larsiaId, 'Larsia'),
    ] as never);
    vi.mocked(getEntry).mockImplementation((id) =>
      (id === larsiaId ? buildTown(larsiaId, 'Larsia') : undefined) as never,
    );
    const state = buildState({
      [larsiaId]: buildTownState({
        raidTelegraphedAtTick: 900,
        raidEngageWindowExpiresAtTick: 2000,
      }),
    });

    raidDefenseGlobalEffectApply(state, 1000);

    expect(state.globalEffects).toEqual([]);
  });
});
