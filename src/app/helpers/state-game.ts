import { computed, signal } from '@angular/core';
import { defaultGameState } from '@helpers/defaults';
import { debug, error } from '@helpers/engine/logging';
import { schedulerYield } from '@helpers/engine/scheduler';
import { indexedDbSignal } from '@helpers/engine/signal';
import { type GameState } from '@interfaces';

export const isGameStateReady = signal<boolean>(false);
export const hasGameStateLoaded = signal<boolean>(false);

let tickGamestate: GameState | undefined = undefined;

const _liveGameState = signal<GameState>(defaultGameState());

export function gamestate() {
  return tickGamestate ?? _liveGameState();
}

// Mid-tick reads return the draft, but still read the slice so a computed first evaluated mid-tick keeps a signal dependency.
function gamestateSlice<K extends keyof GameState>(key: K): () => GameState[K] {
  const slice = computed(() => _liveGameState()[key]);
  return () => {
    const committed = slice();
    return tickGamestate ? tickGamestate[key] : committed;
  };
}

export const workersState = gamestateSlice('workers');
export const discoveredWorkersState = gamestateSlice('discoveredWorkers');
export const materialsState = gamestateSlice('materials');
export const discoveredMaterialsState = gamestateSlice('discoveredMaterials');
export const collectiblesState = gamestateSlice('collectibles');
export const discoveredEquipmentState = gamestateSlice('discoveredEquipment');
export const discoveredRecipesState = gamestateSlice('discoveredRecipes');
export const discoveredCaravansState = gamestateSlice('discoveredCaravans');
export const discoveredGatherNodesState = gamestateSlice(
  'discoveredGatherNodes',
);
export const gatherNodeLevelsState = gamestateSlice('gatherNodeLevels');
export const worldDiscoveriesState = gamestateSlice('worldDiscoveries');
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

export async function updateGamestate(
  func: (state: GameState) => GameState,
): Promise<void> {
  if (tickGamestate) {
    const uncommitted = tickGamestate;
    const res = func(uncommitted);
    if (!res) {
      error(
        'GameState:Update',
        `Failed to update game state. Would be set to a falsy value.`,
        new Error(),
      );
      return;
    }

    tickGamestate = res;

    return;
  }

  await schedulerYield();
  const uncommitted = _liveGameState();
  const res = func(uncommitted);
  if (!res) {
    error(
      'GameState:Update',
      `Failed to update game state. Would be set to a falsy value.`,
      new Error().stack,
    );
    return;
  }

  setGameState(structuredClone(res));
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
  tickGamestate = Object.assign({}, _liveGameState());
}

export function gamestateTickEnd(): void {
  if (tickGamestate) {
    _liveGameState.set(tickGamestate);
  }

  tickGamestate = undefined;
}
