import { t } from '@helpers/i18n/i18n';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { RowEquipmentSellValueComponent } from '@components/row-equipment-sell-value/row-equipment-sell-value.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
} from '@helpers/item/equipment-display';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import type { EquipmentContent, EquipmentItem } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-armory-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RowEquipmentSellValueComponent,
    RowInfusedMaterialsComponent,
    TooltipItemPreviewComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
    SFXDirective,
  ],
  templateUrl: './slot-armory-item.component.html',
  styleUrl: './slot-armory-item.component.scss',
})
export class SlotArmoryItemComponent {
  public equipment = input.required<EquipmentContent>();
  public equipmentItem = input.required<EquipmentItem>();
  public sellMode = input(false);
  public selected = input(false);

  // Emits whether to select a range from the last toggled item.
  public toggleSelect = output<boolean>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    ffGamepadOn('details', () => this.toggleSelect.emit(true), {
      element: host,
      enabled: () => this.sellMode() && host.contains(document.activeElement),
      label: t('slotArmoryItem.selectRange'),
    });
  }

  public display = computed(() =>
    itemPreviewDisplay('equipment', this.equipment(), this.equipmentItem()),
  );

  public bonusStats = computed(() =>
    equipmentItemBonusStats(this.equipmentItem()),
  );

  public bonusResistances = computed(() =>
    equipmentItemBonusResistances(this.equipmentItem()),
  );

  public bonusCombatStats = computed(() =>
    equipmentItemBonusCombatStats(this.equipmentItem()),
  );

  public infusionSlotCount = computed(() =>
    equipmentItemSlotCount(this.equipmentItem()),
  );
}
