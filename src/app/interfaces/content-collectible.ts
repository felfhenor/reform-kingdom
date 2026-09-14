import type { HasSprite } from '@interfaces/artable';
import type { GlobalEffectEffect } from '@interfaces/content-globaleffect';
import type { HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type CollectibleId = Branded<string, 'CollectibleId'>;

export type CollectibleContent = IsContentItem &
  HasDescription &
  HasSprite &
  HasRarity & {
    id: CollectibleId;

    unobtainable?: boolean;

    // Granted permanently while at least one copy is owned - never stacks with extra copies.
    effects: GlobalEffectEffect[];
  };
