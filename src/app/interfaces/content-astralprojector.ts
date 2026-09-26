import type { CollectibleId } from '@interfaces/content-collectible';
import type { GlobalEffectId } from '@interfaces/content-globaleffect';
import type { HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { ItemQuantity } from '@interfaces/cost';

export type AstralProjectorId = Branded<string, 'AstralProjectorId'>;

export type AstralProjectorRequirementCollectible = {
  collectibleId: CollectibleId;
};

export type AstralProjectorRequirementMaterial = ItemQuantity;

export type AstralProjectorContent = IsContentItem &
  HasRarity & {
    id: AstralProjectorId;
    __type: 'astralprojector';

    globalEffectId: GlobalEffectId;
    duration: number;

    requiredCollectibles: AstralProjectorRequirementCollectible[];
    requiredMaterials: AstralProjectorRequirementMaterial[];
  };
