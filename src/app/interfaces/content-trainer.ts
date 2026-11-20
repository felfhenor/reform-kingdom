import type { TrainerTeachingId } from '@interfaces/content-trainer-teaching';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasNodeBackground } from '@interfaces/node-background';
import type { HasDescription } from '@interfaces/traits';
import type {
  WorldNodeAnimatable,
  WorldNodeHideable,
} from '@interfaces/world-nodes';

export type TrainerId = Branded<string, 'TrainerId'>;

export type TrainerContent = IsContentItem &
  HasDescription &
  WorldNodeHideable &
  HasNodeBackground &
  WorldNodeAnimatable & {
    id: TrainerId;
    __type: 'trainer';

    trainerTeachingIds: TrainerTeachingId[];
  };
