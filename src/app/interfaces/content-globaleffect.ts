import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type GlobalEffectId = Branded<string, 'GlobalEffectId'>;

export type GlobalEffectContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: GlobalEffectId;
    __type: 'globaleffect';
  };

export type GlobalEffect = GlobalEffectContent & {
  startTick: number;
  expiresAtTick: number;
};
