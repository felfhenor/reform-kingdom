import type { TrainerTeachingId } from '@interfaces/content-trainer-teaching';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type TrainerId = Branded<string, 'TrainerId'>;

export type TrainerContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: TrainerId;
    __type: 'trainer';

    trainerTeachingIds: TrainerTeachingId[];
  };
