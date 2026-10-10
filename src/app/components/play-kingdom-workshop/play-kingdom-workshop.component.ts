import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  linkedSignal,
  signal,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconComponent } from '@components/icon/icon.component';
import { PanelEquipmentPickerComponent } from '@components/panel-equipment-picker/panel-equipment-picker.component';
import { PanelKingdomWorkshopInfuseComponent } from '@components/panel-kingdom-workshop-infuse/panel-kingdom-workshop-infuse.component';
import { PanelKingdomWorkshopReforgeComponent } from '@components/panel-kingdom-workshop-reforge/panel-kingdom-workshop-reforge.component';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { ownedEquipmentItem } from '@helpers/hero/character-equipment.ui';
import { canModifyEquipment } from '@helpers/item/equipment';
import {
  equipmentItemSlotCount,
  isInfusionUnlocked,
} from '@helpers/item/infusion';
import { equipmentItemPreviewDisplay } from '@helpers/item/item-preview.ui';
import { isReforgeUnlocked } from '@helpers/item/reforge';
import { isEquipmentItemReforgeable } from '@helpers/item/reforge.ui';
import type {
  EquipmentArmoryEntry,
  EquipmentItem,
  EquipmentItemId,
  EquipmentPickerSource,
  WorkshopTabOption,
} from '@interfaces';
import { PluralizePipe } from '@pipes/pluralize.pipe';

const WORKSHOP_TABS: WorkshopTabOption[] = [
  {
    id: 'infuse',
    label: 'Infuse',
    icon: 'gameMagicPotion',
    tutorialTarget: 'kingdom-workshop-tab-infuse',
    isUnlocked: isInfusionUnlocked,
    canModify: (item) => equipmentItemSlotCount(item) > 0,
  },
  {
    id: 'reforge',
    label: 'Reforge',
    icon: 'gameAnvilImpact',
    tutorialTarget: 'kingdom-workshop-tab-reforge',
    isUnlocked: isReforgeUnlocked,
    canModify: isEquipmentItemReforgeable,
  },
];

@Component({
  selector: 'app-play-kingdom-workshop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    CardPageComponent,
    DecimalPipe,
    PanelEquipmentPickerComponent,
    PanelKingdomWorkshopInfuseComponent,
    PanelKingdomWorkshopReforgeComponent,
    PluralizePipe,
    SFXDirective,
    TeleportOutletDirective,
    TutorialTargetDirective,
    IconComponent,
  ],
  templateUrl: './play-kingdom-workshop.component.html',
})
export class PlayKingdomWorkshopComponent {
  public readonly actionOutlet = 'kingdom-workshop-action';

  public selectedSource = signal<EquipmentPickerSource | undefined>(undefined);
  public selectedEquipmentItemId = signal<EquipmentItemId | undefined>(
    undefined,
  );

  public tabs = computed(() => WORKSHOP_TABS.filter((tab) => tab.isUnlocked()));

  // Falls back to the first unlocked tab, since either feature can unlock first.
  public activeTab = linkedSignal<
    WorkshopTabOption[],
    WorkshopTabOption | undefined
  >({
    source: this.tabs,
    computation: (tabs, previous) =>
      tabs.find((tab) => tab.id === previous?.value?.id) ?? tabs[0],
  });

  // Union of every unlocked tab, so switching tabs never drops the selected item out of the armory list.
  public armoryFilter = (entry: EquipmentArmoryEntry) =>
    this.tabs().some((tab) => tab.canModify(entry.item));

  public itemEnabled = computed(
    () => this.activeTab()?.canModify ?? (() => false),
  );

  public selectedItem = computed(() =>
    ownedEquipmentItem(this.selectedEquipmentItemId()),
  );

  public selectedItemDisplay = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemPreviewDisplay(item) : undefined;
  });

  // Only equipped gear is locked mid-fight.
  public modifiable = computed(
    () => this.selectedSource() === 'armory' || canModifyEquipment(),
  );

  public filledSlotCount(item: EquipmentItem): number {
    return item.infusedItemIds.filter(Boolean).length;
  }

  public slotCountFor(item: EquipmentItem): number {
    return equipmentItemSlotCount(item);
  }
}
