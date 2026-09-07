import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(() => []),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/hero/global-effect-state', () => ({
  applyGlobalEffectRemove: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { applyGlobalEffectRemove } from '@helpers/hero/global-effect-state';
import { raidDefenseGlobalEffectApply } from '@helpers/town/raid/town-raid-defense';
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
    commissionSlots: [],
    specialtyPriority: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntriesByType).mockReturnValue([]);
  vi.mocked(getEntry).mockReturnValue(undefined);
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

  it('removes the effect by its real content id (not the lookup name) and adds nothing when no town is telegraphed', () => {
    vi.mocked(getEntry).mockReturnValue(effectContent as never);
    const state = buildState({ [larsiaId]: buildTownState() });

    raidDefenseGlobalEffectApply(state, 1000);

    // The lookup name is not the id stored on a pushed effect -
    // removal must use the resolved content's real id or it silently never matches.
    expect(applyGlobalEffectRemove).toHaveBeenCalledWith(
      state,
      effectContent.id,
    );
    expect(applyGlobalEffectRemove).not.toHaveBeenCalledWith(
      state,
      'Raid Defense Requested',
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

    expect(applyGlobalEffectRemove).toHaveBeenCalledWith(
      state,
      effectContent.id,
    );
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
    vi.mocked(getEntry).mockImplementation(
      (id) =>
        (id === larsiaId ? buildTown(larsiaId, 'Larsia') : undefined) as never,
    );
    const state = buildState({
      [larsiaId]: buildTownState({
        raidTelegraphedAtTick: 900,
        raidEngageWindowExpiresAtTick: 2000,
      }),
    });

    raidDefenseGlobalEffectApply(state, 1000);

    expect(applyGlobalEffectRemove).not.toHaveBeenCalled();
    expect(state.globalEffects).toEqual([]);
  });
});
