import type { HasSprite } from '@interfaces/artable';
import type { HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type CollectibleId = Branded<string, 'CollectibleId'>;

export type CollectibleContent = IsContentItem &
  HasDescription & HasSprite & HasRarity & {
    id: CollectibleId;
  };
