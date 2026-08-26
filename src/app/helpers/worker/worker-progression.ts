import { getEntry } from '@helpers/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { roundToNearest10 } from '@helpers/engine/number';
import { hasGold, spendGold } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  WorkerContent,
  WorkerId,
  WorkerLevelUpStatusEntry,
  WorkerStatBlock,
  WorkerState,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Same curve shape as tradeskillXpForLevel (see crafting/tradeskill.ts) - the
// house curve for any leveled system - with its own cap/start/end.
export const WORKER_MAX_LEVEL = 99;
const WORKER_XP_START = 10;
const WORKER_XP_END = 10000;
const XP_CURVE_EASE = 1.5;

export function workerXpForLevel(level: number): number {
  const progress = (level - 1) / (WORKER_MAX_LEVEL - 1);
  const xp =
    WORKER_XP_START +
    (WORKER_XP_END - WORKER_XP_START) * progress ** XP_CURVE_EASE;
  return roundToNearest10(xp);
}

// Pure `base + perLevel * (level - 1)`, same formula as characterStatsForLevel -
// no cached/stored stats field needed, workers have no equipment layer to blend in.
export function workerStatsForLevel(
  worker: WorkerContent,
  level: number,
): WorkerStatBlock {
  return {
    capacity:
      worker.baseStats.capacity + worker.statsPerLevel.capacity * (level - 1),
    gatherSpeed:
      worker.baseStats.gatherSpeed +
      worker.statsPerLevel.gatherSpeed * (level - 1),
    stamina:
      worker.baseStats.stamina + worker.statsPerLevel.stamina * (level - 1),
  };
}

// Lowest level whose stamina covers `requiredStamina`, or undefined if it never does by WORKER_MAX_LEVEL.
export function workerMinLevelForStamina(
  worker: WorkerContent,
  requiredStamina: number,
): number | undefined {
  const { stamina: base } = worker.baseStats;
  const { stamina: perLevel } = worker.statsPerLevel;

  if (base >= requiredStamina) return 1;
  if (perLevel <= 0) return undefined;

  const level = 1 + Math.ceil((requiredStamina - base) / perLevel);
  return level <= WORKER_MAX_LEVEL ? level : undefined;
}

export function defaultWorkerState(): WorkerState {
  const kingdom = kingdomNodeGet();
  const location: CurrentLocation = kingdom
    ? { mapName: kingdom.mapName, x: kingdom.x, y: kingdom.y }
    : { mapName: '', x: 0, y: 0 };

  return {
    level: 1,
    xp: { current: 0, maximum: workerXpForLevel(1) },
    location,
    status: { kind: 'AtDuchy' },
    assignment: null,
  };
}

// Clamps at the current level's cap - never banks/overflows into a free
// level-up, which must always be a deliberate, gold-gated player action.
export function workerGainXp(workerId: WorkerId, amount: number): void {
  if (amount <= 0) return;

  updateGamestate((state) => {
    const worker = state.workers[workerId];
    if (!worker) return state;

    worker.xp.current = clamp(worker.xp.current + amount, 0, worker.xp.maximum);
    return state;
  });
}

export function workerLevelUpCost(currentLevel: number): number {
  return workerXpForLevel(currentLevel + 1) * 10;
}

// Xp maxed, gold affordable, and under the level cap - the full gate `workerLevelUp` enforces.
export function workerIsReadyToLevelUp(worker: WorkerState): boolean {
  return (
    worker.level < WORKER_MAX_LEVEL &&
    worker.xp.current >= worker.xp.maximum &&
    hasGold(workerLevelUpCost(worker.level))
  );
}

// One entry per rescued worker ready to level up right now - built for the corner status indicator.
export function workersReadyToLevelUpEntries(): WorkerLevelUpStatusEntry[] {
  const workers = gamestate().workers;

  return (Object.keys(workers) as WorkerId[])
    .map((workerId) => {
      const worker = workers[workerId];
      if (!workerIsReadyToLevelUp(worker)) return undefined;

      const content = getEntry<WorkerContent>(workerId);
      if (!content) return undefined;

      return {
        workerId,
        name: content.name,
        sprite: content.sprite,
        frames: content.frames,
        level: worker.level,
      };
    })
    .filter((entry): entry is WorkerLevelUpStatusEntry => !!entry);
}

// Deliberately no location/travel-state check - a worker can be leveled up
// from anywhere, not just while parked at the Duchy.
export function workerLevelUp(workerId: WorkerId): boolean {
  const worker = gamestate().workers[workerId];
  if (!worker) return false;
  if (!workerIsReadyToLevelUp(worker)) return false;

  const cost = workerLevelUpCost(worker.level);

  updateGamestate((state) => {
    spendGold(state, cost);

    const target = state.workers[workerId];
    if (!target) return state;

    target.level += 1;
    target.xp = { current: 0, maximum: workerXpForLevel(target.level) };
    return state;
  });

  analyticsSendDesignEvent('Worker:LevelUp');
  return true;
}
