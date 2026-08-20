import type { CollectibleId } from '@interfaces/content-collectible';
import type { GlobalEffectId } from '@interfaces/content-globaleffect';
import type { ItemId } from '@interfaces/content-item';
import type { Branded, IsContentItem } from '@interfaces/identifiable';

export type AstralProjectorId = Branded<string, 'AstralProjectorId'>;

export type AstralProjectorRequirementCollectible = {
  collectibleId: CollectibleId;
};

export type AstralProjectorRequirementMaterial = {
  itemId: ItemId;
  quantity: number;
};

export type AstralProjectorContent = IsContentItem & {
  id: AstralProjectorId;
  __type: 'astralprojector';

  globalEffectId: GlobalEffectId;
  duration: number;

  requiredCollectibles: AstralProjectorRequirementCollectible[];
  requiredMaterials: AstralProjectorRequirementMaterial[];
};
