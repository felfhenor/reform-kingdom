import { computed } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

// test-setup.ts fakes `computed` with a non-memoizing function, which can't verify reactivity.
vi.unmock('@angular/core');

vi.mock('@helpers/engine/signal', () => ({
  indexedDbSignal: vi.fn(() => ({ set: vi.fn() })),
}));

vi.mock('@helpers/engine/scheduler', () => ({
  schedulerYield: vi.fn(() => Promise.resolve()),
}));

vi.mock('@helpers/engine/logging', () => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

import { defaultGameState } from '@helpers/defaults';
import {
  activeAstralProjectorSpellsState,
  collectiblesState,
  discoveredEquipmentState,
  discoveredRecipesState,
  discoveredCaravansState,
  discoveredGatherNodesState,
  gatherNodeLevelsState,
  worldDiscoveriesState,
  shrinesState,
  tutorialsState,
  lootFiltersState,
  armoryState,
  discoveredMaterialsState,
  discoveredWorkersState,
  gamestateTickEnd,
  gamestateTickStart,
  globalEffectSumsState,
  globalEffectsState,
  materialsState,
  setGameState,
  updateGamestate,
  workersState,
} from '@helpers/state-game';
import type { GameState, WorkerId, WorkerState } from '@interfaces';

const WORKER_ID = 'weaver-nell' as WorkerId;

function buildWorker(level: number): WorkerState {
  return {
    level,
    xp: { current: 0, maximum: 10 },
    location: { mapName: 'Carrina', x: 0, y: 0 },
    status: { kind: 'AtDuchy' },
    assignment: null,
  };
}

function seedState(): GameState {
  const state = defaultGameState();
  state.workers = { [WORKER_ID]: buildWorker(1) };
  setGameState(state, false);
  return state;
}

function setLevelViaTick(level: number): void {
  gamestateTickStart();
  updateGamestate((state) => {
    state.workers = {
      ...state.workers,
      [WORKER_ID]: { ...state.workers[WORKER_ID], level },
    };
    return state;
  });
  gamestateTickEnd();
}

describe('workersState', () => {
  afterEach(() => gamestateTickEnd());

  it('returns the committed slice outside a tick', () => {
    const state = seedState();

    expect(workersState()).toBe(state.workers);
  });

  it('notifies a dependent computed after a non-tick update', async () => {
    seedState();
    const level = computed(() => workersState()[WORKER_ID].level);
    expect(level()).toBe(1);

    await updateGamestate((state) => {
      state.workers = { ...state.workers, [WORKER_ID]: buildWorker(3) };
      return state;
    });

    expect(level()).toBe(3);
  });

  it('returns the in-flight draft mid-tick', () => {
    seedState();

    gamestateTickStart();
    updateGamestate((state) => {
      state.workers = { ...state.workers, [WORKER_ID]: buildWorker(9) };
      return state;
    });

    expect(workersState()[WORKER_ID].level).toBe(9);
  });

  it('notifies a dependent computed when a tick replaces the slice', () => {
    seedState();
    const level = computed(() => workersState()[WORKER_ID].level);
    expect(level()).toBe(1);

    setLevelViaTick(5);

    expect(level()).toBe(5);
  });

  it('keeps a computed first evaluated mid-tick reactive after the tick ends', () => {
    seedState();

    gamestateTickStart();
    const level = computed(() => workersState()[WORKER_ID].level);
    expect(level()).toBe(1);
    updateGamestate((state) => {
      state.workers = { ...state.workers, [WORKER_ID]: buildWorker(4) };
      return state;
    });
    gamestateTickEnd();

    expect(level()).toBe(4);
  });

  it('does not notify dependents when a tick leaves the slice untouched', () => {
    seedState();
    let evaluations = 0;
    const count = computed(() => {
      evaluations += 1;
      return Object.keys(workersState()).length;
    });
    const downstream = computed(() => count() * 2);
    downstream();
    const before = evaluations;

    gamestateTickStart();
    updateGamestate((state) => {
      state.clock = { ...state.clock, numTicks: state.clock.numTicks + 1 };
      return state;
    });
    gamestateTickEnd();
    downstream();

    expect(evaluations).toBe(before);
    expect(downstream()).toBe(2);
  });

  it('exposes the discoveredWorkers slice', () => {
    const state = seedState();
    state.discoveredWorkers = { [WORKER_ID]: { foundAt: 1 } };
    setGameState(state, false);

    expect(discoveredWorkersState()).toBe(state.discoveredWorkers);
  });

  it.each([
    ['materials', materialsState],
    ['discoveredMaterials', discoveredMaterialsState],
    ['collectibles', collectiblesState],
    ['discoveredEquipment', discoveredEquipmentState],
    ['discoveredRecipes', discoveredRecipesState],
    ['discoveredCaravans', discoveredCaravansState],
    ['discoveredGatherNodes', discoveredGatherNodesState],
    ['gatherNodeLevels', gatherNodeLevelsState],
    ['worldDiscoveries', worldDiscoveriesState],
    ['shrines', shrinesState],
    ['tutorials', tutorialsState],
    ['lootFilters', lootFiltersState],
    ['armory', armoryState],
    ['globalEffects', globalEffectsState],
    ['globalEffectSums', globalEffectSumsState],
    ['activeAstralProjectorSpells', activeAstralProjectorSpellsState],
  ] as const)('exposes the %s slice', (key, selector) => {
    const state = seedState();

    expect(selector()).toBe(state[key]);
  });
});
