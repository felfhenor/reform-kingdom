import { defaultWorkerStats } from '@helpers/defaults';
import type { WorkerContent, WorkerId, WorkerStatBlock } from '@interfaces';

function ensureWorkerStats(
  statblock: Partial<WorkerStatBlock> = {},
): Required<WorkerStatBlock> {
  return Object.assign({}, defaultWorkerStats(), statblock);
}

export function ensureWorker(
  worker: Partial<WorkerContent>,
): Required<WorkerContent> {
  const baseStats = ensureWorkerStats(worker.baseStats);
  // A 0 gatherSpeed would make worker-gathering's tick formula divide by
  // zero (infinite ticks per unit) - floor the BASE value only (not
  // statsPerLevel, which can legitimately be a small or zero per-level
  // increment) so a missing/zero-authored value can never produce a
  // silent, permanent gather stall.
  baseStats.gatherSpeed = Math.max(1, baseStats.gatherSpeed);

  return {
    id: worker.id ?? ('UNKNOWN' as WorkerId),
    name: worker.name ?? 'UNKNOWN',
    __type: 'worker',
    description: worker.description ?? 'UNKNOWN',
    sprite: worker.sprite ?? 'UNKNOWN',
    frames: worker.frames ?? 4,
    baseStats,
    statsPerLevel: ensureWorkerStats(worker.statsPerLevel),
  };
}
