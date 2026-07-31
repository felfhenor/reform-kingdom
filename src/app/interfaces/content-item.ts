import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type ItemId = Branded<string, 'ItemId'>;

export type ItemContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: ItemId;
  };
