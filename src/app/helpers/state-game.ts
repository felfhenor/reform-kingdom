import { computed, signal } from '@angular/core';
import { defaultGameState } from '@helpers/defaults';
import { debug, error } from '@helpers/engine/logging';
import { schedulerYield } from '@helpers/engine/scheduler';
import { indexedDbSignal } from '@helpers/engine/signal';
import { type GameState } from '@interfaces';
import { produce } from 'immer';

export const isGameStateReady = signal<boolean>(false);
export const hasGameStateLoaded = signal<boolean>(false);

let tickGamestate: GameState | undefined = undefined;

// The Immer draft of the callback currently running, so reads inside it see the callback's own earlier writes.
let activeDraft: GameState | undefined = undefined;

const _liveGameState = signal<GameState>(defaultGameState());

export function gamestate() {
  return activeDraft ?? tickGamestate ?? _liveGameState();
}

// Mid-tick / mid-callback reads return the in-flight state, but still read the slice so a computed first evaluated then keeps a signal dependency.
function gamestateSelect<T>(pick: (state: GameState) => T): () => T {
  const slice = computed(() => pick(_liveGameState()));
  return () => {
    const committed = slice();
    const inFlight = activeDraft ?? tickGamestate;
    return inFlight ? pick(inFlight) : committed;
  };
}

function gamestateSlice<K extends keyof GameState>(key: K): () => GameState[K] {
  return gamestateSelect((state) => state[key]);
}

export const workersState = gamestateSlice('workers');
export const discoveredWorkersState = gamestateSlice('discoveredWorkers');
export const materialsState = gamestateSlice('materials');
export const discoveredMaterialsState = gamestateSlice('discoveredMaterials');
export const collectiblesState = gamestateSlice('collectibles');
export const discoveredEquipmentState = gamestateSlice('discoveredEquipment');
export const discoveredRecipesState = gamestateSlice('discoveredRecipes');
export const discoveredCaravansState = gamestateSlice('discoveredCaravans');
export const discoveredTrainersState = gamestateSlice('discoveredTrainers');
export const discoveredGatherNodesState = gamestateSlice(
  'discoveredGatherNodes',
);
export const gatherNodeLevelsState = gamestateSlice('gatherNodeLevels');
export const worldDiscoveriesState = gamestateSlice('worldDiscoveries');
export const bestiaryState = gamestateSlice('bestiary');
export const tradeskillsState = gamestateSlice('tradeskills');
export const clockState = gamestateSlice('clock');
export const worldPartyState = gamestateSelect((state) => state.world.party);
export const worldCombatState = gamestateSelect((state) => state.world.combat);
export const worldCurrentLocationState = gamestateSelect(
  (state) => state.world.currentLocation,
);
export const worldTravelState = gamestateSelect((state) => state.world.travel);
export const worldGatheringState = gamestateSelect(
  (state) => state.world.gathering,
);
export const worldAutoModeState = gamestateSelect(
  (state) => state.world.autoMode,
);
export const worldExploreRandomState = gamestateSelect(
  (state) => state.world.exploreRandom,
);
export const worldHomeNodeNameState = gamestateSelect(
  (state) => state.world.homeNodeName,
);
export const worldCaravansState = gamestateSelect(
  (state) => state.world.caravans,
);
export const worldCommissionsState = gamestateSelect(
  (state) => state.world.commissions,
);
export const worldTownsState = gamestateSelect((state) => state.world.towns);
export const shrinesState = gamestateSlice('shrines');
export const tutorialsState = gamestateSlice('tutorials');
export const lootFiltersState = gamestateSlice('lootFilters');
export const armoryState = gamestateSlice('armory');
export const globalEffectsState = gamestateSlice('globalEffects');
export const globalEffectSumsState = gamestateSlice('globalEffectSums');
export const activeAstralProjectorSpellsState = gamestateSlice(
  'activeAstralProjectorSpells',
);

const _savedGamestate = indexedDbSignal<GameState>(
  'gamestate',
  defaultGameState(),
  (state: GameState) => {
    if (hasGameStateLoaded()) return;

    _liveGameState.set(state);

    hasGameStateLoaded.set(true);
  },
);

export function setGameState(state: GameState, commit = true): void {
  _liveGameState.set(state);

  if (commit) {
    debug('GameState:Commit', 'Committing game state changes.');
    saveGameState();
  }
}

class FalsyUpdateResult extends Error {}

function updateFailed(stack?: string): void {
  error(
    'GameState:Update',
    `Failed to update game state. Would be set to a falsy value.`,
    stack,
  );
}

// A throwing callback aborts its whole draft, so no partial writes leak into the state.
function produceUpdate(
  base: GameState,
  func: (state: GameState) => GameState,
): GameState | undefined {
  try {
    return produce(base, (draft) => {
      activeDraft = draft as unknown as GameState;
      if (!func(activeDraft)) throw new FalsyUpdateResult();
    });
  } catch (e) {
    if (e instanceof FalsyUpdateResult) return undefined;
    throw e;
  } finally {
    activeDraft = undefined;
  }
}

export async function updateGamestate(
  func: (state: GameState) => GameState,
): Promise<void> {
  if (!tickGamestate) await schedulerYield();

  // Checked after the yield too - a tick that opened meanwhile would otherwise overwrite this update when it commits.
  if (tickGamestate) {
    // Nested in a running callback: join its draft, like a shared in-place state used to.
    if (activeDraft) {
      if (!func(activeDraft)) updateFailed(new Error().stack);
      return;
    }

    const res = produceUpdate(tickGamestate, func);
    if (res) tickGamestate = res;
    else updateFailed(new Error().stack);

    return;
  }

  const res = produceUpdate(_liveGameState(), func);
  if (!res) {
    updateFailed(new Error().stack);
    return;
  }

  setGameState(res);
}

export function resetGameState(): void {
  setGameState(defaultGameState());
}

export function saveGameState(): void {
  _savedGamestate.set(formatGameStateForSave(_liveGameState()));
}

export function formatGameStateForSave(gameState: GameState): GameState {
  const optimized = structuredClone(gameState);
  return optimized;
}

export function gamestateTickStart(): void {
  tickGamestate = _liveGameState();
}

export function gamestateTickEnd(): void {
  if (tickGamestate) {
    _liveGameState.set(tickGamestate);
  }

  tickGamestate = undefined;
}
