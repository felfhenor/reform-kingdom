import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/combat', () => ({
  currentCombat: vi.fn(() => undefined),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/decree', () => ({
  decreeClauses: vi.fn(() => []),
  decreeRiskTolerance: vi.fn(() => 'Medium'),
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

vi.mock('@helpers/world-nodes', () => ({
  rewardContentInfo: vi.fn(),
  worldNodeByName: vi.fn(),
  worldNodeGatherMaterialIds: vi.fn(() => []),
  worldNodesOfType: vi.fn(() => []),
}));

import {
  autoModeIsEnabled,
  autoModeProcessTick,
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeStatusLabel,
  autoModeToggle,
} from '@helpers/auto-mode';
import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import {
  decreeClauses,
  decreeRiskTolerance,
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
import {
  rewardContentInfo,
  worldNodeByName,
  worldNodeGatherMaterialIds,
  worldNodesOfType,
} from '@helpers/world-nodes';
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
        riskTolerance: 'Medium',
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

  it('describes an active LevelUpParty clause using the global risk tolerance', () => {
    const clause = buildClause({
      id: 'a' as DecreeClauseId,
      type: 'LevelUpParty',
    });
    vi.mocked(gamestate).mockReturnValue(
      buildState({ clauses: [clause], activeClauseId: 'a' as DecreeClauseId }),
    );
    vi.mocked(decreeRiskTolerance).mockReturnValue('High');

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

    // `gamestate()` is a static mock here (unlike the real store, it doesn't
    // reflect this tick's own `updateGamestate` calls as they happen), so
    // adoption and the target-reached stop can't both be observed within one
    // synthetic tick - the "stops gathering once a GatherMaterial target is
    // reached" test above already proves the stop-check works correctly
    // once a clause is active. This test only needs to prove adoption itself
    // fires - i.e. the *first* update sets the matched clause active.
    const firstUpdateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = firstUpdateFn(buildState({ activeClauseId: undefined }));
    expect(result.world.autoMode.activeClauseId).toBe('copper-clause');
  });

  it('does not adopt an in-progress gather with no matching enabled clause', () => {
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

    // The disabled clause is never adopted, so there's nothing whose target
    // could be "reached" - gathering must be left alone either way.
    expect(gatheringStop).not.toHaveBeenCalled();
  });

  it('does not adopt when the gathering node has no matching material at all', () => {
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

    expect(gatheringStop).not.toHaveBeenCalled();
  });
});
