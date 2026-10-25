import type { CollectibleId } from '@interfaces/content-collectible';
import type { TrainerTeachingId } from '@interfaces/content-trainer-teaching';
import type { HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type RumorId = Branded<string, 'RumorId'>;

export type RumorSubject =
  | { kind: 'Node'; nodeName: string }
  | { kind: 'Collectible'; collectibleId: CollectibleId }
  | { kind: 'TrainerTeaching'; trainerTeachingId: TrainerTeachingId };

// `description` is the hint itself: whispered by the Founder, and shown on a caravan's reveal offer.
export type RumorContent = IsContentItem &
  HasDescription &
  HasRarity & {
    id: RumorId;
    __type: 'rumor';

    subject: RumorSubject;

    // Map the party must have visited before the rumor can be heard; empty for none.
    requireMapVisit: string;
  };
