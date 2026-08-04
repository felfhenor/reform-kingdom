import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import { defaultStats } from '@helpers/defaults';
import type {
  EquipmentBlock,
  EquipmentContent,
  EquipmentItem,
  StatBlock,
} from '@interfaces';

// Gear can be swapped freely while gathering, but not mid-fight.
export function canModifyEquipment(): boolean {
  return !currentCombat();
}

export function equippedItems(equipment: EquipmentBlock): EquipmentItem[] {
  return (
    Object.values(equipment) as EquipmentBlock[keyof EquipmentBlock][]
  ).filter((item): item is EquipmentItem => !!item);
}

export function equipmentStatTotals(equipment: EquipmentBlock): StatBlock {
  const totals = defaultStats();

  (Object.values(equipment) as EquipmentBlock[keyof EquipmentBlock][]).forEach(
    (item) => {
      if (!item) return;

      const content = getEntry<EquipmentContent>(item.equipmentId);
      if (!content) return;

      (Object.keys(totals) as Array<keyof StatBlock>).forEach((stat) => {
        totals[stat] += content.baseStats[stat];
      });
    },
  );

  return totals;
}
