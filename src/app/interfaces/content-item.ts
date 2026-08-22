import type { HasSprite } from '@interfaces/artable';
import type { StatusEffectTag } from '@interfaces/content-statuseffect';
import type { HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type ItemId = Branded<string, 'ItemId'>;

export type ItemContent = IsContentItem &
  HasDescription &
  HasSprite &
  HasRarity & {
    id: ItemId;

    // Flat stat bonus granted when this item is infused into an equipment
    // slot (see `helpers/infusion.ts`). Absent for ordinary materials -
    // only a small set of items opt into being infusable.
    infusionStats?: StatBlock;

    // Same idea as `infusionStats`, but for per-tag debuff resistance.
    infusionDebuffResistances?: Record<StatusEffectTag, number>;

    unobtainable?: boolean;
  };
