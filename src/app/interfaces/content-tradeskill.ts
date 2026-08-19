import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type TradeskillId = Branded<string, 'TradeskillId'>;

export type TradeskillContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: TradeskillId;
    __type: 'tradeskill';
  };
