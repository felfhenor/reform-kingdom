import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat/combat-state', () => ({
  currentCombat: vi.fn(() => undefined),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/decree/decree', () => ({
  decreeClauses: vi.fn(() => []),
  decreeWaitForFullHealthBeforeCombat: vi.fn(() => false),
}));

vi.mock('@helpers/decree/decree-evaluation', () => ({
  clauseTargetNode: vi.fn(),
  isClauseBlockedOnlyByHealth: vi.fn(() => false),
  pickNextClause: vi.fn(),
}));

vi.mock('@helpers/item/gathering', () => ({
  gatheringStop: vi.fn(),
  isGathering: vi.fn(() => false),
}));

vi.mock('@helpers/hero/global-effects', () => ({
  addGlobalEffect: vi.fn(),
  isGlobalEffectActive: vi.fn(() => false),
  removeGlobalEffect: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
  getMaterialQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/hero/party', () => ({
  isPartyAtFullHealth: vi.fn(() => true),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/hero/travel', () => ({
  travelStart: vi.fn(),
}));

vi.mock('@helpers/town/raid/town-raid-combat', () => ({
  raidEngageCombat: vi.fn(() => false),
}));

vi.mock('@helpers/town/town-spawn', () => ({
  homeNodeGet: vi.fn(() => undefined),
  isPlayerAtHome: vi.fn(() => false),
}));

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(() => undefined),
}));

vi.mock('@helpers/world-node/world-node-gathering-discovery', () => ({
  worldNodeGatherMaterialIds: vi.fn(() => []),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeTown: vi.fn(() => undefined),
}));

import { currentCombat } from '@helpers/combat/combat-state';
import { getEntry } from '@helpers/content/content';
import {
  autoModeIsEnabled,
  autoModeProcessTick,
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeRecordNodeFailure,
  autoModeRecordNodeSuccess,
  autoModeResetNodeFailureCounts,
  autoModeToggle,
} from '@helpers/decree/auto-mode';
import {
  decreeClauses,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import {
  clauseTargetNode,
  isClauseBlockedOnlyByHealth,
  pickNextClause,
} from '@helpers/decree/decree-evaluation';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/hero/global-effects';
import { isPartyAtFullHealth } from '@helpers/hero/party';
import { travelStart } from '@helpers/hero/travel';
import { gatheringStop, isGathering } from '@helpers/item/gathering';
import { getMaterialQuantity } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { raidEngageCombat } from '@helpers/town/raid/town-raid-combat';
import { homeNodeGet, isPlayerAtHome } from '@helpers/town/town-spawn';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import {
  worldNodeByName,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import type {
  DecreeClause,
  DecreeClauseId,
  GameState,
  ItemContent,
  ItemId,
  MaterialId,
  TownContent,
  TownId,
  WorldNodeEntry,
} from '@interfaces';

function buildClause(overrides: Partial<DecreeClause> = {}): DecreeClause {
  return {
    id: 'clause-1' as DecreeClauseId,
    type: 'FinishUnfinishedAreas',
    enabled: true,
    failureCount: 0,
    riskTolerance: 'Medium',
    ...overrides,
  } as DecreeClause;
}

function buildState(overrides: {
  enabled?: boolean;
  clauses?: DecreeClause[];
  activeClauseId?: DecreeClauseId;
  travelStatus?: 'Idle' | 'Traveling';
  travelDestinationNodeName?: string;
  gatheringStatus?: 'Idle' | 'Gathering';
  gatheringNodeName?: string;
  nodeFailureCounts?: Partial<Record<string, number>>;
}): GameState {
  return {
    world: {
      travel: {
        status: overrides.travelStatus ?? 'Idle',
        destinationNodeName: overrides.travelDestinationNodeName,
        path: [],
        ticksIntoStep: 0,
      },
      gathering: {
        status: overrides.gatheringStatus ?? 'Idle',
        ticksIntoGather: 0,
        nodeName: overrides.gatheringNodeName,
      },
      autoMode: {
        enabled: overrides.enabled ?? true,
        clauses: overrides.clauses ?? [],
        activeClauseId: overrides.activeClauseId,
        nodeFailureCounts: overrides.nodeFailureCounts ?? {},
      },
    },
  } as unknown as GameState;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentCombat).mockReturnValue(undefined);
  vi.mocked(isGathering).mockReturnValue(false);
  vi.mocked(isGlobalEffectActive).mockReturnValue(false);
  vi.mocked(isPlayerAtHome).mockReturnValue(false);
  vi.mocked(homeNodeGet).mockReturnValue(undefined);
  vi.mocked(pickNextClause).mockReturnValue(undefined);
  vi.mocked(isClauseBlockedOnlyByHealth).mockReturnValue(false);
  vi.mocked(worldNodeByName).mockReturnValue(undefined);
  vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([]);
  vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(false);
  vi.mocked(isPartyAtFullHealth).mockReturnValue(true);
  vi.mocked(raidEngageCombat).mockReturnValue(false);
  vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);
  vi.mocked(worldNodeTown).mockReturnValue(undefined);
  vi.mocked(clauseTargetNode).mockReturnValue(undefined);
});

describe('autoModeIsEnabled / autoModeToggle', () => {
  it('reads the enabled flag from state', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    expect(autoModeIsEnabled()).toBe(true);
  });

  it('turning off clears the active clause', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    autoModeToggle(false);

    const result = applyLastUpdate(
      buildState({ activeClauseId: 'clause-1' as DecreeClauseId }),
    );
    expect(result.world.autoMode.enabled).toBe(false);
    expect(result.world.autoMode.activeClauseId).toBeUndefined();
  });
});

describe('autoModeRecordClauseFailure', () => {
  it('does nothing when no clause is active', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    autoModeRecordClauseFailure();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('increments only the active clause', () => {
    const clauses = [
      buildClause({ id: 'a' as DecreeClauseId, failureCount: 0 }),
      buildClause({ id: 'b' as DecreeClauseId, failureCount: 2 }),
    ];
    vi.mocked(gamestate).mockReturnValue(
      buildState({ clauses, activeClauseId: 'b' as DecreeClauseId }),
    );

    autoModeRecordClauseFailure();

    const result = applyLastUpdate(
      buildState({ clauses, activeClauseId: 'b' as DecreeClauseId }),
    );
    expect(
      result.world.autoMode.clauses.find((c) => c.id === 'a')?.failureCount,
    ).toBe(0);
    expect(
      result.world.autoMode.clauses.find((c) => c.id === 'b')?.failureCount,
    ).toBe(3);
  });
});

describe('autoModeRecordClauseSuccess', () => {
  it('does nothing when no clause is active', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    autoModeRecordClauseSuccess();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('resets only the active clause failure count to zero', () => {
    const clauses = [
      buildClause({ id: 'a' as DecreeClauseId, failureCount: 4 }),
      buildClause({ id: 'b' as DecreeClauseId, failureCount: 2 }),
    ];
    vi.mocked(gamestate).mockReturnValue(
      buildState({ clauses, activeClauseId: 'b' as DecreeClauseId }),
    );

    autoModeRecordClauseSuccess();

    const result = applyLastUpdate(
      buildState({ clauses, activeClauseId: 'b' as DecreeClauseId }),
    );
    expect(
      result.world.autoMode.clauses.find((c) => c.id === 'a')?.failureCount,
    ).toBe(4);
    expect(
      result.world.autoMode.clauses.find((c) => c.id === 'b')?.failureCount,
    ).toBe(0);
  });
});

describe('autoModeRecordNodeFailure', () => {
  it('increments only the named node, leaving others untouched', () => {
    const nodeFailureCounts = { A: 1, B: 4 };
    vi.mocked(gamestate).mockReturnValue(buildState({ nodeFailureCounts }));

    autoModeRecordNodeFailure('A');

    const result = applyLastUpdate(buildState({ nodeFailureCounts }));
    expect(result.world.autoMode.nodeFailureCounts.A).toBe(2);
    expect(result.world.autoMode.nodeFailureCounts.B).toBe(4);
  });

  it('starts a node at 1 the first time it fails', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    autoModeRecordNodeFailure('New');

    const result = applyLastUpdate(buildState({}));
    expect(result.world.autoMode.nodeFailureCounts.New).toBe(1);
  });
});

describe('autoModeRecordNodeSuccess', () => {
  it('resets only the named node back to zero', () => {
    const nodeFailureCounts = { A: 3, B: 4 };
    vi.mocked(gamestate).mockReturnValue(buildState({ nodeFailureCounts }));

    autoModeRecordNodeSuccess('A');

    const result = applyLastUpdate(buildState({ nodeFailureCounts }));
    expect(result.world.autoMode.nodeFailureCounts.A).toBe(0);
    expect(result.world.autoMode.nodeFailureCounts.B).toBe(4);
  });
});

describe('autoModeResetNodeFailureCounts', () => {
  it('wipes every recorded node failure count', () => {
    const nodeFailureCounts = { A: 3, B: 4 };
    vi.mocked(gamestate).mockReturnValue(buildState({ nodeFailureCounts }));

    autoModeResetNodeFailureCounts();

    const result = applyLastUpdate(buildState({ nodeFailureCounts }));
    expect(result.world.autoMode.nodeFailureCounts).toEqual({});
  });
});

describe('autoModeProcessTick', () => {
  it('does nothing when disabled beyond removing a stale effect', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: false }));
    vi.mocked(isGlobalEffectActive).mockReturnValue(true);
    vi.mocked(getEntry).mockReturnValue({
      id: 'auto-mode-effect',
    } as ItemContent);

    autoModeProcessTick();

    expect(removeGlobalEffect).toHaveBeenCalledWith('auto-mode-effect');
    expect(travelStart).not.toHaveBeenCalled();
    expect(gatheringStop).not.toHaveBeenCalled();
  });

  it('grants the Auto Mode effect once when first enabled', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(isGlobalEffectActive).mockReturnValue(false);

    autoModeProcessTick();

    expect(addGlobalEffect).toHaveBeenCalledWith(
      'Auto Mode',
      expect.any(Number),
    );
  });

  it('does not re-grant the effect on every tick once active', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(isGlobalEffectActive).mockReturnValue(true);

    autoModeProcessTick();

    expect(addGlobalEffect).not.toHaveBeenCalled();
  });

  it('does not act while the party is mid-combat', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(currentCombat).mockReturnValue(
      {} as ReturnType<typeof currentCombat>,
    );

    autoModeProcessTick();

    expect(travelStart).not.toHaveBeenCalled();
  });

  it('travels to the picked clause target when idle', () => {
    const clause = buildClause({ type: 'FinishUnfinishedAreas' });
    vi.mocked(gamestate).mockReturnValue(
      buildState({ enabled: true, clauses: [clause] }),
    );
    vi.mocked(decreeClauses).mockReturnValue([clause]);
    vi.mocked(pickNextClause).mockReturnValue(clause);
    vi.mocked(clauseTargetNode).mockReturnValue({
      nodeName: 'Old Ruins',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(travelStart).toHaveBeenCalledWith('Old Ruins', true);
  });

  it('engages the raid instead of re-dispatching travel when idle at the DefendTowns target', () => {
    const clause = buildClause({
      id: 'a' as DecreeClauseId,
      type: 'DefendTowns',
      riskTolerance: 'High',
    });
    const town = { id: 'larsia' as TownId, name: 'Larsia' } as TownContent;
    const node = { nodeName: 'Larsia' } as WorldNodeEntry;
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: clause.id,
      }),
    );
    vi.mocked(clauseTargetNode).mockReturnValue(node);
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(node);
    vi.mocked(worldNodeTown).mockReturnValue(town);
    vi.mocked(raidEngageCombat).mockReturnValue(true);

    autoModeProcessTick();

    expect(raidEngageCombat).toHaveBeenCalledWith('larsia');
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('falls through to normal dispatch when not yet standing at the DefendTowns target', () => {
    const clause = buildClause({
      id: 'a' as DecreeClauseId,
      type: 'DefendTowns',
      riskTolerance: 'High',
    });
    const node = { nodeName: 'Larsia' } as WorldNodeEntry;
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: clause.id,
      }),
    );
    vi.mocked(decreeClauses).mockReturnValue([clause]);
    vi.mocked(pickNextClause).mockReturnValue(clause);
    vi.mocked(clauseTargetNode).mockReturnValue(node);
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);

    autoModeProcessTick();

    expect(raidEngageCombat).not.toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledWith('Larsia', true);
  });

  it('does not attempt to engage for a non-DefendTowns active clause', () => {
    const clause = buildClause({
      id: 'a' as DecreeClauseId,
      type: 'FinishUnfinishedAreas',
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: clause.id,
      }),
    );
    vi.mocked(decreeClauses).mockReturnValue([clause]);
    vi.mocked(pickNextClause).mockReturnValue(clause);

    autoModeProcessTick();

    expect(raidEngageCombat).not.toHaveBeenCalled();
  });

  it('falls back home when no clause is satisfiable and not already there', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(pickNextClause).mockReturnValue(undefined);
    vi.mocked(isPlayerAtHome).mockReturnValue(false);
    vi.mocked(homeNodeGet).mockReturnValue({
      nodeName: 'Kingdom',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(travelStart).toHaveBeenCalledWith('Kingdom', true);
  });

  it('does not travel when the fallback is already satisfied at home', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(pickNextClause).mockReturnValue(undefined);
    vi.mocked(isPlayerAtHome).mockReturnValue(true);

    autoModeProcessTick();

    expect(travelStart).not.toHaveBeenCalled();
  });

  it('stays put instead of falling back home while blocked only by health', () => {
    const clause = buildClause({ type: 'LevelUpParty' });
    vi.mocked(gamestate).mockReturnValue(
      buildState({ enabled: true, clauses: [clause] }),
    );
    vi.mocked(pickNextClause).mockReturnValue(undefined);
    vi.mocked(isClauseBlockedOnlyByHealth).mockReturnValue(true);
    vi.mocked(isPlayerAtHome).mockReturnValue(false);

    autoModeProcessTick();

    expect(travelStart).not.toHaveBeenCalled();
  });

  it('stops gathering once a GatherMaterial target is reached', () => {
    const clause = buildClause({
      type: 'GatherMaterial',
      materialId: 'wood' as MaterialId,
      targetQuantity: 5,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: clause.id,
        gatheringStatus: 'Gathering',
      }),
    );
    vi.mocked(getMaterialQuantity).mockReturnValue(5);

    autoModeProcessTick();

    expect(gatheringStop).toHaveBeenCalled();
  });

  it('leaves gathering alone while the target is still short', () => {
    const clause = buildClause({
      type: 'GatherMaterial',
      materialId: 'wood' as MaterialId,
      targetQuantity: 5,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: clause.id,
        gatheringStatus: 'Gathering',
      }),
    );
    vi.mocked(getMaterialQuantity).mockReturnValue(2);

    autoModeProcessTick();

    expect(gatheringStop).not.toHaveBeenCalled();
  });

  it('adopts an in-progress gather that matches an enabled clause, when no clause is currently tracked as active (regression: the party would otherwise gather a matched material forever, past its target, since the stop-check never had a clause to check against)', () => {
    const clause = buildClause({
      id: 'copper-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 1000,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: undefined,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Carrina Copper Mines',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(worldNodeByName).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'copper-ore' as MaterialId,
    ]);

    autoModeProcessTick();

    // `gamestate()` is a static mock, so adoption and the target-reached stop can't both be observed in one tick - this only proves adoption fires (the first update sets the matched clause active).
    const firstUpdateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = firstUpdateFn(buildState({ activeClauseId: undefined }));
    expect(result.world.autoMode.activeClauseId).toBe('copper-clause');
  });

  it('stops an in-progress gather with no matching enabled clause instead of leaving it stuck forever', () => {
    const disabledClause = buildClause({
      id: 'copper-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 1000,
      enabled: false,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [disabledClause],
        activeClauseId: undefined,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Carrina Copper Mines',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(worldNodeByName).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'copper-ore' as MaterialId,
    ]);

    autoModeProcessTick();

    expect(gatheringStop).toHaveBeenCalled();
  });

  it('breaks off an orphaned gather and heads home when hurt and waiting for full health', () => {
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [],
        activeClauseId: undefined,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Wergen Woods',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);
    vi.mocked(isPlayerAtHome).mockReturnValue(false);
    vi.mocked(homeNodeGet).mockReturnValue({
      nodeName: 'Kingdom',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(gatheringStop).toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledWith('Kingdom', true);
  });

  it('stops a gather whose active clause was disabled mid-session and moves on to the next enabled clause in the same tick, even though it is still tracked as active and short of its target', () => {
    const disabledClause = buildClause({
      id: 'copper-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 1000,
      enabled: false,
    });
    const farmClause = buildClause({
      id: 'jelly-clause' as DecreeClauseId,
      type: 'FarmNode',
      nodeName: 'Jelly Fields',
      reward: { itemId: 'jelly' as ItemId },
      targetQuantity: 10,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [disabledClause, farmClause],
        activeClauseId: disabledClause.id,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Carrina Copper Mines',
      }),
    );
    vi.mocked(isGathering).mockImplementation(
      () => vi.mocked(gatheringStop).mock.calls.length === 0,
    );
    vi.mocked(getMaterialQuantity).mockReturnValue(2);
    vi.mocked(decreeClauses).mockReturnValue([disabledClause, farmClause]);
    vi.mocked(pickNextClause).mockReturnValue(farmClause);
    vi.mocked(clauseTargetNode).mockReturnValue({
      nodeName: 'Jelly Fields',
    } as WorldNodeEntry);

    autoModeProcessTick();

    // A disabled clause shouldn't keep holding the party at its node.
    expect(gatheringStop).toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledWith('Jelly Fields', true);
  });

  it('stops an orphaned gather without forcing a trip home when at full health', () => {
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [],
        activeClauseId: undefined,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Wergen Woods',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(true);

    autoModeProcessTick();

    // Full health means no reason to route home, but the orphaned gather still ends so per-tick evaluation can take back over.
    expect(gatheringStop).toHaveBeenCalled();
  });

  it('actually falls through to evaluating the next clause once an orphaned gather is stopped at full health, rather than just canceling it', () => {
    const clause = buildClause({ type: 'FinishUnfinishedAreas' });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [],
        activeClauseId: undefined,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Wergen Woods',
      }),
    );
    // Makes `isGathering` reflect `gatheringStop()` mid-tick, so this proves Auto Mode picks back up afterward (not just that the gather was canceled).
    vi.mocked(isGathering).mockImplementation(
      () => vi.mocked(gatheringStop).mock.calls.length === 0,
    );
    vi.mocked(decreeClauses).mockReturnValue([clause]);
    vi.mocked(pickNextClause).mockReturnValue(clause);
    vi.mocked(clauseTargetNode).mockReturnValue({
      nodeName: 'Old Ruins',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(gatheringStop).toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledWith('Old Ruins', true);
  });

  it('does not touch a clause-tracked gather that is still short of its target, even when hurt and waiting for full health', () => {
    const clause = buildClause({
      id: 'copper-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 1000,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: clause.id,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Carrina Copper Mines',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(getMaterialQuantity).mockReturnValue(2);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(true);

    autoModeProcessTick();

    expect(gatheringStop).not.toHaveBeenCalled();
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('leaves a clause-tracked gather alone even while hurt and waiting for full health', () => {
    const clause = buildClause({
      id: 'copper-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 1000,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: clause.id,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Carrina Copper Mines',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(getMaterialQuantity).mockReturnValue(2);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);

    autoModeProcessTick();

    expect(gatheringStop).not.toHaveBeenCalled();
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('abandons an in-progress gather immediately when reordering makes a different clause top priority', () => {
    const woodClause = buildClause({
      id: 'wood-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wergen-wood' as MaterialId,
      targetQuantity: 50,
    });
    const copperClause = buildClause({
      id: 'copper-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 30,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [copperClause, woodClause],
        activeClauseId: woodClause.id,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Wergen Woods',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(getMaterialQuantity).mockReturnValue(10);
    vi.mocked(decreeClauses).mockReturnValue([copperClause, woodClause]);
    vi.mocked(pickNextClause).mockReturnValue(copperClause);
    vi.mocked(clauseTargetNode).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(gatheringStop).toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledWith('Carrina Copper Mines', true);
  });

  it('hands active-clause tracking to the new top-priority clause without restarting the action when both target the same node', () => {
    const oldClause = buildClause({
      id: 'old-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wergen-wood' as MaterialId,
      targetQuantity: 50,
    });
    const newClause = buildClause({
      id: 'new-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wergen-stick' as MaterialId,
      targetQuantity: 20,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [newClause, oldClause],
        activeClauseId: oldClause.id,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Wergen Woods',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(getMaterialQuantity).mockReturnValue(5);
    vi.mocked(decreeClauses).mockReturnValue([newClause, oldClause]);
    vi.mocked(pickNextClause).mockReturnValue(newClause);
    // Both clauses are gatherable at the same node - a multi-material GatherNode.
    vi.mocked(clauseTargetNode).mockReturnValue({
      nodeName: 'Wergen Woods',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(gatheringStop).not.toHaveBeenCalled();
    expect(travelStart).not.toHaveBeenCalled();

    const result = applyLastUpdate(
      buildState({ activeClauseId: oldClause.id }),
    );
    expect(result.world.autoMode.activeClauseId).toBe('new-clause');
  });

  it('abandons an in-progress gather when the active clause is edited in place (same id, new material), not just reordered', () => {
    const clause = buildClause({
      id: 'top-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wergen-wood' as MaterialId,
      targetQuantity: 50,
    });
    const editedClause = { ...clause, materialId: 'copper-ore' as MaterialId };
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [editedClause],
        activeClauseId: clause.id,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Wergen Woods',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(getMaterialQuantity).mockReturnValue(10);
    vi.mocked(decreeClauses).mockReturnValue([editedClause]);
    vi.mocked(pickNextClause).mockReturnValue(editedClause);
    vi.mocked(clauseTargetNode).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(gatheringStop).toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledWith('Carrina Copper Mines', true);
  });

  it('redirects mid-travel immediately when a reorder/edit changes the top priority target', () => {
    const oldClause = buildClause({
      id: 'farm-clause' as DecreeClauseId,
      type: 'FarmNode',
      nodeName: 'Old Ruins',
      reward: { itemId: 'bone' as ItemId },
      targetQuantity: 10,
    });
    const newClause = buildClause({
      id: 'gather-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 30,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [newClause, oldClause],
        activeClauseId: oldClause.id,
        travelStatus: 'Traveling',
        travelDestinationNodeName: 'Old Ruins',
      }),
    );
    vi.mocked(decreeClauses).mockReturnValue([newClause, oldClause]);
    vi.mocked(pickNextClause).mockReturnValue(newClause);
    vi.mocked(clauseTargetNode).mockReturnValue({
      nodeName: 'Carrina Copper Mines',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(gatheringStop).not.toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledWith('Carrina Copper Mines', true);
  });

  it('does not re-dispatch when the active clause is still top priority after a tick', () => {
    const clause = buildClause({
      id: 'wood-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wergen-wood' as MaterialId,
      targetQuantity: 50,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: clause.id,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Wergen Woods',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(getMaterialQuantity).mockReturnValue(10);
    vi.mocked(decreeClauses).mockReturnValue([clause]);
    vi.mocked(pickNextClause).mockReturnValue(clause);
    vi.mocked(clauseTargetNode).mockReturnValue({
      nodeName: 'Wergen Woods',
    } as WorldNodeEntry);

    autoModeProcessTick();

    expect(gatheringStop).not.toHaveBeenCalled();
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('never interrupts mid-combat even if a reorder would otherwise change priority', () => {
    const woodClause = buildClause({
      id: 'wood-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wergen-wood' as MaterialId,
      targetQuantity: 50,
    });
    const copperClause = buildClause({
      id: 'copper-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 30,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [copperClause, woodClause],
        activeClauseId: woodClause.id,
      }),
    );
    vi.mocked(currentCombat).mockReturnValue(
      {} as ReturnType<typeof currentCombat>,
    );
    vi.mocked(decreeClauses).mockReturnValue([copperClause, woodClause]);
    vi.mocked(pickNextClause).mockReturnValue(copperClause);

    autoModeProcessTick();

    expect(gatheringStop).not.toHaveBeenCalled();
    expect(travelStart).not.toHaveBeenCalled();
  });

  it('stops gathering when the gathering node has no matching material at all, rather than leaving it orphaned and stuck forever', () => {
    const clause = buildClause({
      id: 'copper-clause' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'copper-ore' as MaterialId,
      targetQuantity: 1000,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({
        enabled: true,
        clauses: [clause],
        activeClauseId: undefined,
        gatheringStatus: 'Gathering',
        gatheringNodeName: 'Wergen Woods',
      }),
    );
    vi.mocked(isGathering).mockReturnValue(true);
    vi.mocked(worldNodeByName).mockReturnValue({
      nodeName: 'Wergen Woods',
    } as WorldNodeEntry);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'wergen-wood' as MaterialId,
    ]);

    autoModeProcessTick();

    // No enabled clause targets this material, so it's orphaned.
    expect(gatheringStop).toHaveBeenCalled();
  });
});
