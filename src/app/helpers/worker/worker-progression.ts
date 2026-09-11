import {
  WORKER_MAX_LEVEL,
  WORKER_XP_END,
  WORKER_XP_START,
  XP_CURVE_EASE,
} from '@helpers/config';
import { roundToNearest10 } from '@helpers/engine/number';
import { hasGold } from '@helpers/item/materials';
import { updateGamestate } from '@helpers/state-game';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  WorkerContent,
  WorkerId,
  WorkerStatBlock,
  WorkerState,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function workerXpForLevel(level: number): number {
  const progress = (level - 1) / (WORKER_MAX_LEVEL - 1);
  const xp =
    WORKER_XP_START +
    (WORKER_XP_END - WORKER_XP_START) * progress ** XP_CURVE_EASE;
  return roundToNearest10(xp);
}

export function statBlockForLevel(
  base: WorkerStatBlock,
  perLevel: WorkerStatBlock,
  level: number,
): WorkerStatBlock {
  return {
    capacity: base.capacity + perLevel.capacity * (level - 1),
    gatherSpeed: base.gatherSpeed + perLevel.gatherSpeed * (level - 1),
    stamina: base.stamina + perLevel.stamina * (level - 1),
  };
}

// No cached/stored stats field needed, workers have no equipment layer to blend in.
export function workerStatsForLevel(
  worker: WorkerContent,
  level: number,
): WorkerStatBlock {
  return statBlockForLevel(worker.baseStats, worker.statsPerLevel, level);
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
