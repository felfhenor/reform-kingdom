import { ensureArray } from '@helpers/content/ensure-helpers-core';
import type {
  AstralProjectorContent,
  AstralProjectorId,
  AstralProjectorRequirementCollectible,
  AstralProjectorRequirementMaterial,
  GlobalEffectId,
  ItemId,
} from '@interfaces';

function ensureAstralProjectorRequirement(
  requirement: Partial<AstralProjectorRequirementCollectible> &
    Partial<AstralProjectorRequirementMaterial> = {},
): AstralProjectorRequirementCollectible | AstralProjectorRequirementMaterial {
  if (requirement.collectibleId) {
    return { collectibleId: requirement.collectibleId };
  }

  return {
    itemId: requirement.itemId ?? ('UNKNOWN' as ItemId),
    quantity: requirement.quantity ?? 1,
  };
}

export function ensureAstralProjector(
  astralProjector: Partial<AstralProjectorContent>,
): Required<AstralProjectorContent> {
  return {
    id: astralProjector.id ?? ('UNKNOWN' as AstralProjectorId),
    name: astralProjector.name ?? 'UNKNOWN',
    __type: 'astralprojector',
    globalEffectId:
      astralProjector.globalEffectId ?? ('UNKNOWN' as GlobalEffectId),
    duration: astralProjector.duration ?? 60,
    requiredCollectibles: ensureArray(
      astralProjector.requiredCollectibles,
      ensureAstralProjectorRequirement,
    ) as AstralProjectorRequirementCollectible[],
    requiredMaterials: ensureArray(
      astralProjector.requiredMaterials,
      ensureAstralProjectorRequirement,
    ) as AstralProjectorRequirementMaterial[],
    rarity: astralProjector.rarity ?? 'Common',
  };
}
