import {
  REGION_GEAR_DROP_LEVELS_ABOVE,
  REGION_GEAR_DROP_LEVELS_BELOW,
  REGION_MATERIAL_DROP_COST_FRACTION,
} from '@helpers/config';
import {
  craftedMaterialHomes,
  equipmentHomeGear,
} from '@helpers/item/equipment-home-map';
import { materialCostDemand } from '@helpers/item/material-cost-demand';
import { rngChoice, rngChoiceWeighted, rngNumberRange } from '@helpers/rng';
import { globalEffectSumsState } from '@helpers/state-game';
import type {
  CraftedMaterialHome,
  DropChanceBonus,
  EquipmentContent,
  ItemId,
  ResolvedEquipmentDrop,
  ResolvedItemDrop,
} from '@interfaces';
import { clamp, mean } from 'es-toolkit/compat';

// One roll per kill, not one row per piece, so the chance and any drop bonus apply once.
function rollsRegionDrop(baseChance: number, bonus: number): boolean {
  if (baseChance <= 0) return false;
  return rngNumberRange(0, 99) < clamp(baseChance + bonus, 0, 100);
}

export function regionGearCandidates(
  mapName: string,
  level: number,
): EquipmentContent[] {
  return equipmentHomeGear(mapName).filter(
    (equipment) =>
      level >= equipment.levelRequirement - REGION_GEAR_DROP_LEVELS_BELOW &&
      level <= equipment.levelRequirement + REGION_GEAR_DROP_LEVELS_ABOVE,
  );
}

export function rollRegionGearDrop(
  mapName: string,
  level: number,
  bonus: DropChanceBonus = {},
): ResolvedEquipmentDrop[] {
  const chance = globalEffectSumsState().regionGearDropChance;
  if (!rollsRegionDrop(chance, bonus.Equipment ?? 0)) return [];

  const candidates = regionGearCandidates(mapName, level);
  if (candidates.length === 0) return [];

  return [{ kind: 'Equipment', equipmentId: rngChoice(candidates).id }];
}

// No upper bound, so an overleveled party can still finish a late upgrade.
export function regionMaterialCandidates(
  mapName: string,
  level: number,
): CraftedMaterialHome[] {
  return craftedMaterialHomes(mapName).filter(
    (home) => home.level <= level + REGION_GEAR_DROP_LEVELS_BELOW,
  );
}

export function regionMaterialDropQuantity(itemId: ItemId): number {
  const largest = materialCostDemand().get(itemId)?.largest ?? 0;
  return Math.max(1, Math.round(largest * REGION_MATERIAL_DROP_COST_FRACTION));
}

// Demand-weighted, floored at the pool's average so a material needed once (for Remembrance) still turns up.
export function regionMaterialWeights(
  candidates: CraftedMaterialHome[],
): Map<ItemId, number> {
  const demand = materialCostDemand();
  const totals = candidates.map((home) => demand.get(home.item.id)?.total ?? 0);
  const floor = Math.max(1, mean(totals));
  return new Map(
    candidates.map((home, index) => [
      home.item.id,
      Math.max(floor, totals[index]),
    ]),
  );
}

export function rollRegionMaterialDrop(
  mapName: string,
  level: number,
  bonus: DropChanceBonus = {},
): ResolvedItemDrop[] {
  const chance = globalEffectSumsState().regionMaterialDropChance;
  if (!rollsRegionDrop(chance, bonus.Item ?? 0)) return [];

  const candidates = regionMaterialCandidates(mapName, level);
  const weights = regionMaterialWeights(candidates);
  const picked = rngChoiceWeighted(
    candidates,
    (home) => weights.get(home.item.id) ?? 1,
  );
  if (!picked) return [];

  const itemId = picked.item.id;
  return [
    { kind: 'Item', itemId, quantity: regionMaterialDropQuantity(itemId) },
  ];
}
