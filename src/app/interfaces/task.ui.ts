import type { TaskId } from '@interfaces/content-task';
import type { ItemQuantity } from '@interfaces/cost';
import type { WorldNodeEntry } from '@interfaces/world-nodes';

export type TaskRowViewModel = {
  taskId: TaskId;
  name: string;
  description: string;
  isComplete: boolean;
  isClaimed: boolean;
  // Only set for incomplete tasks that count toward a quantity.
  progress?: { current: number; target: number };
  rewards: (ItemQuantity & { name: string })[];
  // Only set for incomplete tasks tied to a placed world node; the reason is empty when locatable.
  locate?: { node: WorldNodeEntry; disabledReason: string };
};
