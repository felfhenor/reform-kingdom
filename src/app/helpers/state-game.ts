import { computed, signal } from '@angular/core';
import { defaultGameState } from '@helpers/defaults';
import { SAVEFILE_SAVE_ERROR_NOTIFY_INTERVAL_MS } from '@helpers/config';
import { debug, error, info } from '@helpers/engine/logging';
import { notifyError, notifyWarning } from '@helpers/engine/notify';
import { schedulerYield } from '@helpers/engine/scheduler';
import { indexedDbSignal } from '@helpers/engine/signal';
import {
  savefileDiskRead,
  savefileDiskWrite,
  savefileNewerStorage,
} from '@helpers/savefile/savefile-disk';
import { savefileIsWorthKeeping } from '@helpers/savefile/savefile-validate';
import { type GameState } from '@interfaces';
import { freeze, produce, setAutoFreeze } from 'immer';

export const isGameStateReady = signal<boolean>(false);
export const hasGameStateLoaded = signal<boolean>(false);

let tickGamestate: GameState | undefined = undefined;

// Immer's own default.
let isAutoFreezing = true;

export function gamestateSetAutoFreeze(enabled: boolean): void {
  isAutoFreezing = enabled;
  setAutoFreeze(enabled);
}

// Immer rescans a large fresh subtree assigned into a draft for nested drafts unless it's already frozen.
export function gamestateFreezeSubtree<T>(value: T): T {
  return freeze(value, isAutoFreezing);
}

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
export const discoveredTradersState = gamestateSlice('discoveredTraders');
export const discoveredTrainersState = gamestateSlice('discoveredTrainers');
export const visitedWorldNodesState = gamestateSlice('visitedWorldNodes');
export const gatherNodeLevelsState = gamestateSlice('gatherNodeLevels');
export const worldDiscoveriesState = gamestateSlice('worldDiscoveries');
export const discoveredMapsState = gamestateSlice('discoveredMaps');
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
export const worldPrayerLastTickState = gamestateSelect(
  (state) => state.world.prayerLastTick,
);
export const worldCaravansState = gamestateSelect(
  (state) => state.world.caravans,
);
export const worldCommissionsState = gamestateSelect(
  (state) => state.world.commissions,
);
export const worldTownsState = gamestateSelect((state) => state.world.towns);
export const shrinesState = gamestateSlice('shrines');
export const outpostsState = gamestateSlice('outposts');
export const tutorialsState = gamestateSlice('tutorials');
export const metaState = gamestateSlice('meta');
export const regionIntrosState = gamestateSlice('regionIntros');
export const tasksState = gamestateSlice('tasks');
export const lootFiltersState = gamestateSlice('lootFilters');
export const armoryState = gamestateSlice('armory');
export const regaliasState = gamestateSlice('regalias');
export const edictsState = gamestateSlice('edicts');
export const legacyClearedEdictsState = gamestateSlice('legacyClearedEdicts');
export const runStatsState = gamestateSlice('runStats');
export const globalEffectsState = gamestateSlice('globalEffects');
export const globalEffectSumsState = gamestateSlice('globalEffectSums');
export const activeAstralProjectorSpellsState = gamestateSlice(
  'activeAstralProjectorSpells',
);

export const gameStateLoadError = signal<unknown>(undefined);

// Held while a save is unloadable or mid-migration, so nothing can overwrite the stored copy.
let isSavingBlocked = false;

export function setGameStateSavingBlocked(blocked: boolean): void {
  isSavingBlocked = blocked;
}

export const GAMESTATE_STORAGE_KEY = 'gamestate';

let lastSaveErrorNotifyAt = -Infinity;

function notifySaveFailed(message: string): void {
  const now = Date.now();
  if (now - lastSaveErrorNotifyAt < SAVEFILE_SAVE_ERROR_NOTIFY_INTERVAL_MS) {
    return;
  }

  lastSaveErrorNotifyAt = now;
  notifyError(message);
}

// The stored copy that wasn't loaded, so the load can back it up before the first save overwrites it.
export const gameStateLoadAlternate = signal<unknown>(undefined);

// Set when browser storage couldn't be read, so its copy is left as-is for the session.
let isBrowserSaveBlocked = false;

// Only ever increases, so a system clock change can't make an older save look newer.
let lastSavedAt = 0;

function gameStateLoadFinish(state: GameState, alternate: unknown): void {
  _liveGameState.set(state);
  lastSavedAt = state.meta.savedAt ?? 0;
  gameStateLoadAlternate.set(alternate);
  hasGameStateLoaded.set(true);
}

async function gameStateLoadStored(browserState: GameState): Promise<void> {
  const diskState = await savefileDiskRead();
  if (hasGameStateLoaded()) return;

  if (savefileNewerStorage(browserState, diskState) === 'browser') {
    gameStateLoadFinish(browserState, diskState);
    return;
  }

  info('GameState:Load', 'Loading the newer disk savefile.');
  gameStateLoadFinish(diskState as GameState, browserState);
}

// Browser storage breaking is the main reason the desktop build keeps a disk copy.
async function gameStateLoadStoredFailed(e: unknown): Promise<void> {
  error('GameState:Load', 'Could not read the savefile from storage.', e);
  const diskState = await savefileDiskRead();
  if (hasGameStateLoaded()) return;

  if (savefileIsWorthKeeping(diskState)) {
    isBrowserSaveBlocked = true;
    notifyWarning(
      'Your savefile could not be read from browser storage, so the copy on disk was loaded.',
    );
    gameStateLoadFinish(diskState, undefined);
    return;
  }

  isSavingBlocked = true;
  gameStateLoadError.set(e ?? new Error('Unknown storage error'));
  hasGameStateLoaded.set(true);
}

const _savedGamestate = indexedDbSignal<GameState>(
  GAMESTATE_STORAGE_KEY,
  defaultGameState(),
  (state) => void gameStateLoadStored(state),
  (e) => void gameStateLoadStoredFailed(e),
  () => notifySaveFailed('Your game could not be saved to storage.'),
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

// Resolves false only if every write failed; most callers don't need to wait.
// Held until the stored copy loads, so an early save can't overwrite it with the default state.
export async function saveGameState(): Promise<boolean> {
  if (isSavingBlocked || !hasGameStateLoaded()) return true;

  lastSavedAt = Math.max(Date.now(), lastSavedAt + 1);
  const state = formatGameStateForSave(_liveGameState(), lastSavedAt);
  if (!isBrowserSaveBlocked) _savedGamestate.set(state);

  const [browserSaved, diskSaved] = await Promise.all([
    isBrowserSaveBlocked ? false : _savedGamestate.flush(),
    savefileDiskWrite(state),
  ]);
  if (diskSaved === false)
    notifySaveFailed('Your game could not be saved to disk.');
  return browserSaved || diskSaved === true;
}

// The stamp is how the desktop build tells which of its two stored copies is newer.
export function formatGameStateForSave(
  gameState: GameState,
  savedAt: number,
): GameState {
  const optimized = structuredClone(gameState);
  optimized.meta.savedAt = savedAt;
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
