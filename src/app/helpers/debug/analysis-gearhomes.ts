/**
 * Lists each map's home gear and crafted-only materials for the region drop
 * effects, and warns on any that can never drop (no home, or no fight in range).
 */

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { isRecipeTownUnique } from '@helpers/crafting/recipe-town-unique';
import {
  craftedMaterialHomesBuild,
  equipmentHomeMapsBuild,
} from '@helpers/item/equipment-home-map';
import { materialCostDemand } from '@helpers/item/material-cost-demand';
import { regionMaterialDropQuantity } from '@helpers/item/region-gear-drop';
import {
  regionGearSources,
  regionMaterialSources,
} from '@helpers/item/region-sources';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EquipmentContent,
  EquipmentId,
  RecipeContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

function playerCraftedEquipmentIds(): Set<EquipmentId> {
  return new Set(
    getEntriesByType<RecipeContent>('recipe').flatMap((recipe) =>
      'equipmentId' in recipe.result && !isRecipeTownUnique(recipe.id)
        ? [recipe.result.equipmentId]
        : [],
    ),
  );
}

function homelessChecks(homes: Map<EquipmentId, string>): AnalysisCheck[] {
  return [...playerCraftedEquipmentIds()]
    .map((id) => getEntry<EquipmentContent>(id))
    .filter(
      (equipment): equipment is EquipmentContent =>
        !!equipment && !equipment.unobtainable && !homes.has(equipment.id),
    )
    .map((equipment) => ({
      id: `gear-home:${equipment.id}`,
      label: equipment.name,
      status: 'warning',
      message: `"${equipment.name}" has no ingredient with a world source, so it never drops as regional gear.`,
    }));
}

function unreachableChecks(homes: Map<EquipmentId, string>): AnalysisCheck[] {
  const gear: AnalysisCheck[] = [...homes.keys()]
    .filter((equipmentId) => regionGearSources({ equipmentId }).length === 0)
    .map((equipmentId) => ({
      id: `gear-window:${equipmentId}`,
      label: getEntry<EquipmentContent>(equipmentId)?.name ?? equipmentId,
      status: 'warning',
      message: `${getEntry<EquipmentContent>(equipmentId)?.name ?? equipmentId}: no fight on its home map ${homes.get(equipmentId)} is within its drop level window, so it never drops.`,
    }));
  const materials: AnalysisCheck[] = craftedMaterialHomesBuild()
    .filter(
      ({ item }) => regionMaterialSources({ itemId: item.id }).length === 0,
    )
    .map(({ item, mapName }) => ({
      id: `material-window:${item.id}`,
      label: item.name,
      status: 'warning',
      message: `${item.name}: no fight on its home map ${mapName} reaches its home level, so it never drops.`,
    }));
  return [...gear, ...materials];
}

function materialRows(): Record<string, string | number>[] {
  const demand = materialCostDemand();
  return sortBy(
    craftedMaterialHomesBuild().map(({ item, mapName, level }) => ({
      name: item.name,
      map: mapName,
      level,
      demand: demand.get(item.id)?.total ?? 0,
      perDrop: regionMaterialDropQuantity(item.id),
    })),
    ['map', 'level', 'name'],
  );
}

export function runGearHomesAnalysis(): AnalysisRunResult {
  const homes = equipmentHomeMapsBuild();
  const rows = sortBy(
    [...homes].flatMap(([id, mapName]) => {
      const equipment = getEntry<EquipmentContent>(id);
      return equipment
        ? [
            {
              name: equipment.name,
              map: mapName,
              level: equipment.levelRequirement,
            },
          ]
        : [];
    }),
    ['map', 'level', 'name'],
  );
  const materials = materialRows();
  const checks = [...homelessChecks(homes), ...unreachableChecks(homes)];

  return {
    checks,
    tables: [
      { title: 'Gear by Home Map', columns: ['name', 'map', 'level'], rows },
      {
        title: 'Crafted-Only Materials by Home Map',
        columns: ['name', 'map', 'level', 'demand', 'perDrop'],
        rows: materials,
      },
    ],
    summary: `${rows.length} gear and ${materials.length} crafted-only materials with a home map, ${checks.length} warnings.`,
  };
}
