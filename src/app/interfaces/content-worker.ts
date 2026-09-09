import type { HasAnimation } from '@interfaces/artable';
import type { HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type WorkerId = Branded<string, 'WorkerId'>;

export type WorkerStatBlock = Record<
  'capacity' | 'gatherSpeed' | 'stamina',
  number
>;

export type WorkerContent = IsContentItem &
  HasRarity &
  HasDescription &
  HasAnimation & {
    id: WorkerId;

    baseStats: WorkerStatBlock;
    statsPerLevel: WorkerStatBlock;

    canUseTeleports: boolean;
  };
