import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ModalComponent } from '@components/modal/modal.component';
import { ModalCloseDirective } from '@directives/modal-close.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { allEquipmentItemTypes } from '@helpers/item/equipment-types';
import {
  lootFilterSetEquipmentTypeKept,
  lootFilterSetMinimumItemLevel,
  lootFilterSetRarityKept,
  lootFilterSettings,
} from '@helpers/kingdom/loot-filter.ui';
import type {
  DropRarity,
  EquipmentItemType,
  LootFilterSettings,
} from '@interfaces';

const RARITIES: DropRarity[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Mystical',
  'Legendary',
];

@Component({
  selector: 'app-modal-loot-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ModalCloseDirective, SFXDirective],
  templateUrl: './modal-loot-filters.component.html',
})
export class ModalLootFiltersComponent {
  public readonly rarities = RARITIES;
  public readonly equipmentTypes = allEquipmentItemTypes();

  public filters = computed<LootFilterSettings>(() => lootFilterSettings());

  public toggleRarity(rarity: DropRarity): void {
    lootFilterSetRarityKept(rarity, !this.filters().keepRarities[rarity]);
  }

  public toggleType(type: EquipmentItemType): void {
    lootFilterSetEquipmentTypeKept(
      type,
      !this.filters().keepEquipmentTypes[type],
    );
  }

  public setMinimumItemLevel(value: number): void {
    if (Number.isNaN(value)) return;
    lootFilterSetMinimumItemLevel(value);
  }
}
