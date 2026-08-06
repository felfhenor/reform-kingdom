import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import {
  debugGiveCollectible,
  debugGiveEquipment,
  debugGiveItem,
  getEntriesByType,
} from '@helpers';
import type {
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
} from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-panel-options-debug',
  imports: [AnalyticsClickDirective, FormsModule, NgSelectComponent],
  templateUrl: './panel-options-debug.component.html',
  styleUrl: './panel-options-debug.component.scss',
})
export class PanelOptionsDebugComponent extends OptionsBaseComponent {
  public debugItems = computed(() =>
    sortBy(getEntriesByType<ItemContent>('item'), (item) => item.name).filter(
      (item) => !item.unobtainable,
    ),
  );

  public debugEquipment = computed(() =>
    sortBy(
      getEntriesByType<EquipmentContent>('equipment'),
      (item) => item.name,
    ),
  );

  public debugCollectibles = computed(() =>
    sortBy(
      getEntriesByType<CollectibleContent>('collectible'),
      (item) => item.name,
    ),
  );

  public selectedItemId = signal<ItemId | undefined>(undefined);
  public itemQuantity = signal<number>(1);

  public selectedEquipmentId = signal<EquipmentId | undefined>(undefined);
  public equipmentQuantity = signal<number>(1);

  public selectedCollectibleId = signal<CollectibleId | undefined>(undefined);
  public collectibleQuantity = signal<number>(1);

  public giveItem(): void {
    const itemId = this.selectedItemId();
    if (!itemId) return;

    debugGiveItem(itemId, this.itemQuantity());
  }

  public giveEquipment(): void {
    const equipmentId = this.selectedEquipmentId();
    if (!equipmentId) return;

    debugGiveEquipment(equipmentId, this.equipmentQuantity());
  }

  public giveCollectible(): void {
    const collectibleId = this.selectedCollectibleId();
    if (!collectibleId) return;

    debugGiveCollectible(collectibleId, this.collectibleQuantity());
  }
}
