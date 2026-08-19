import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat', () => ({
  currentCombat: vi.fn(() => undefined),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/decree', () => ({
  decreeClauses: vi.fn(() => []),
  decreeWaitForFullHealthBeforeCombat: vi.fn(() => false),
}));

vi.mock('@helpers/decree-evaluation', () => ({
  clauseTargetNode: vi.fn(),
  isClauseBlockedOnlyByHealth: vi.fn(() => false),
  pickNextClause: vi.fn(),
}));

vi.mock('@helpers/decree-farm-node', () => ({
  farmNodeRewardQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/gathering', () => ({
  gatheringStop: vi.fn(),
  isGathering: vi.fn(() => false),
}));

vi.mock('@helpers/global-effects', () => ({
  addGlobalEffect: vi.fn(),
  isGlobalEffectActive: vi.fn(() => false),
  removeGlobalEffect: vi.fn(),
}));

vi.mock('@helpers/materials', () => ({
  getMaterialQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/party', () => ({
  isPartyAtFullHealth: vi.fn(() => true),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/travel', () => ({
  travelStart: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  isPlayerAtKingdom: vi.fn(() => false),
}));

vi.mock('@helpers/world-node-gathering', () => ({
  worldNodeGatherMaterialIds: vi.fn(() => []),
}));

vi.mock('@helpers/world-node-rewards', () => ({
  rewardContentInfo: vi.fn(),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodesOfType: vi.fn(() => []),
}));

import {
  autoModeIsEnabled,
  autoModeProcessTick,
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeRecordNodeFailure,
  autoModeRecordNodeSuccess,
  autoModeResetNodeFailureCounts,
  autoModeStatusLabel,
  autoModeToggle,
} from '@helpers/auto-mode';
import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import {
  decreeClauses,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree';
import {
  clauseTargetNode,
  isClauseBlockedOnlyByHealth,
  pickNextClause,
} from '@helpers/decree-evaluation';
import { farmNodeRewardQuantity } from '@helpers/decree-farm-node';
import { gatheringStop, isGathering } from '@helpers/gathering';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/global-effects';
import { getMaterialQuantity } from '@helpers/materials';
import { isPartyAtFullHealth } from '@helpers/party';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { travelStart } from '@helpers/travel';
import { isPlayerAtKingdom } from '@helpers/world';
import { worldNodeGatherMaterialIds } from '@helpers/world-node-gathering';
import { rewardContentInfo } from '@helpers/world-node-rewards';
import { worldNodeByName, worldNodesOfType } from '@helpers/world-nodes';
import type {
  DecreeClause,
  DecreeClauseId,
  GameState,
  ItemContent,
  ItemId,
  MaterialId,
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
  gatheringStatus?: 'Idle' | 'Gathering';
  gatheringNodeName?: string;
  nodeFailureCounts?: Partial<Record<string, number>>;
}): GameState {
  return {
    world: {
      travel: { status: overrides.travelStatus ?? 'Idle', path: [], ticksIntoStep: 0 },
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
  vi.mocked(isPlayerAtKingdom).mockReturnValue(false);
  vi.mocked(pickNextClause).mockReturnValue(undefined);
  vi.mocked(isClauseBlockedOnlyByHealth).mockReturnValue(false);
  vi.mocked(worldNodesOfType).mockReturnValue([]);
  vi.mocked(worldNodeByName).mockReturnValue(undefined);
  vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([]);
  vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(false);
  vi.mocked(isPartyAtFullHealth).mockReturnValue(true);
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
    expect(result.world.autoMode.clauses.find((c) => c.id === 'a')?.failureCount).toBe(0);
    expect(result.world.autoMode.clauses.find((c) => c.id === 'b')?.failureCount).toBe(3);
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
    expect(result.world.autoMode.clauses.find((c) => c.id === 'a')?.failureCount).toBe(4);
    expect(result.world.autoMode.clauses.find((c) => c.id === 'b')?.failureCount).toBe(0);
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

describe('autoModeStatusLabel', () => {
  it('is undefined when auto mode is off', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: false }));

    expect(autoModeStatusLabel()).toBeUndefined();
  });

  it('is Idle when enabled with no active clause', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));

    expect(autoModeStatusLabel()).toBe('Idle');
  });

  it('reports healing instead of Idle while waiting for full health', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);

    expect(autoModeStatusLabel()).toBe('Healing before the next move...');
  });

  it('still reports Idle once healed even with the wait-for-health setting on', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(true);

    expect(autoModeStatusLabel()).toBe('Idle');
  });

  it('describes an active GatherMaterial clause with live stock', () => {
    vi.mocked(getEntry).mockReturnValue({ name: 'Wood' } as ItemContent);
    vi.mocked(getMaterialQuantity).mockReturnValue(3);
    const clause = buildClause({
      id: 'a' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wood' as MaterialId,
      targetQuantity: 10,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({ clauses: [clause], activeClauseId: 'a' as DecreeClauseId }),
    );

    expect(autoModeStatusLabel()).toBe('Gathering Wood (3/10 in stock)...');
  });

  it('describes an active FarmNode clause with live reward progress', () => {
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Bone',
      sprite: '0001',
      spritesheet: 'item',
    });
    vi.mocked(farmNodeRewardQuantity).mockReturnValue(3);
    const clause = buildClause({
      id: 'a' as DecreeClauseId,
      type: 'FarmNode',
      nodeName: 'Forest Ruins',
      reward: { itemId: 'bone' as ItemId },
      targetQuantity: 10,
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({ clauses: [clause], activeClauseId: 'a' as DecreeClauseId }),
    );

    expect(autoModeStatusLabel()).toBe(
      'Farming Forest Ruins for Bone (3/10)...',
    );
  });

  it("describes an active LevelUpParty clause using the clause's risk tolerance", () => {
    const clause = buildClause({
      id: 'a' as DecreeClauseId,
      type: 'LevelUpParty',
      riskTolerance: 'High',
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({ clauses: [clause], activeClauseId: 'a' as DecreeClauseId }),
    );

    expect(autoModeStatusLabel()).toBe('Leveling up (High risk)...');
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
    vi.mocked(currentCombat).mockReturnValue({} as ReturnType<typeof currentCombat>);

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

  it('falls back to the kingdom when no clause is satisfiable and not already there', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(pickNextClause).mockReturnValue(undefined);
    vi.mocked(isPlayerAtKingdom).mockReturnValue(false);
    vi.mocked(worldNodesOfType).mockReturnValue([
      { nodeName: 'Kingdom' } as WorldNodeEntry,
    ]);

    autoModeProcessTick();

    expect(travelStart).toHaveBeenCalledWith('Kingdom', true);
  });

  it('does not travel when the fallback is already satisfied at the kingdom', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    vi.mocked(pickNextClause).mockReturnValue(undefined);
    vi.mocked(isPlayerAtKingdom).mockReturnValue(true);

    autoModeProcessTick();

    expect(travelStart).not.toHaveBeenCalled();
  });

  it('stays put instead of falling back to the kingdom while blocked only by health', () => {
    const clause = buildClause({ type: 'LevelUpParty' });
    vi.mocked(gamestate).mockReturnValue(
      buildState({ enabled: true, clauses: [clause] }),
    );
    vi.mocked(pickNextClause).mockReturnValue(undefined);
    vi.mocked(isClauseBlockedOnlyByHealth).mockReturnValue(true);
    vi.mocked(isPlayerAtKingdom).mockReturnValue(false);

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

    // The disabled clause is never adopted, so `stopOrphanedGather` (not `stopGatherIfTargetReached`) is what ends this gather.
    expect(gatheringStop).toHaveBeenCalled();
  });

  it('breaks off an orphaned gather and heads to the kingdom when hurt and waiting for full health', () => {
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
    vi.mocked(isPlayerAtKingdom).mockReturnValue(false);
    vi.mocked(worldNodesOfType).mockReturnValue([
      { nodeName: 'Kingdom' } as WorldNodeEntry,
    ]);

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
    // Makes the `isGathering` mock reflect `gatheringStop()` mid-tick, so the test exercises the `isPartyIdleForAutoMode` -> `advanceToNextClause` fallthrough, not just the stop.
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

    // A disabled clause shouldn't keep holding the party at its node - `stopOrphanedGather` treats it the same as no active clause.
    expect(gatheringStop).toHaveBeenCalled();
    expect(travelStart).toHaveBeenCalledWith('Jelly Fields', true);
  });

  it('stops an orphaned gather without forcing a kingdom trip when at full health', () => {
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

    // Full health means no reason to route through the kingdom, but the orphaned gather still ends so per-tick evaluation can take back over.
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

    // No enabled clause targets this material, so it's orphaned - `stopOrphanedGather` ends it so clause evaluation resumes.
    expect(gatheringStop).toHaveBeenCalled();
  });
});
