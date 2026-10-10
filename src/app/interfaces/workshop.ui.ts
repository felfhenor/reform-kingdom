import type { Icon } from '@interfaces/artable';
import type { EquipmentItem } from '@interfaces/equipment';

export type WorkshopTab = 'infuse' | 'reforge';

export type WorkshopTabOption = {
  id: WorkshopTab;
  label: string;
  icon: Icon;
  tutorialTarget: string;
  isUnlocked: () => boolean;
  canModify: (item: EquipmentItem) => boolean;
};
