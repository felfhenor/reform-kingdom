import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { getEntry } from '@helpers/content/content';
import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
} from '@helpers/item/equipment-display';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  EquipmentTypeToSlot,
  type EquipmentContent,
  type EquipmentItem,
  type EquipmentSlot,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-equipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    RowInfusedMaterialsComponent,
    TippyDirective,
    TooltipItemPreviewComponent,
  ],
  templateUrl: './slot-equipment.component.html',
  styleUrl: './slot-equipment.component.scss',
})
export class SlotEquipmentComponent {
  public slot = input.required<EquipmentSlot>();
  public equippedItem = input<EquipmentItem>();
  public isSelected = input<boolean>(false);

  public slotClick = output<void>();

  public equippedContent = computed(() => {
    const equipmentId = this.equippedItem()?.equipmentId;
    if (!equipmentId) return undefined;

    return getEntry<EquipmentContent>(equipmentId);
  });

  public displayName = computed(() => {
    const item = this.equippedItem();
    const content = this.equippedContent();
    return item && content ? equipmentItemDisplayName(item, content.name) : '';
  });

  public bonusStats = computed(() => {
    const item = this.equippedItem();
    return item ? equipmentItemBonusStats(item) : defaultStats();
  });

  public bonusResistances = computed(() => {
    const item = this.equippedItem();
    return item ? equipmentItemBonusResistances(item) : defaultTagResistances();
  });

  public bonusCombatStats = computed(() => {
    const item = this.equippedItem();
    return item ? equipmentItemBonusCombatStats(item) : defaultCombatStats();
  });

  public infusionSlotCount = computed(() => {
    const item = this.equippedItem();
    return item ? equipmentItemSlotCount(item) : 0;
  });

  public display = computed(() => {
    const content = this.equippedContent();
    if (content) {
      return {
        ...itemPreviewDisplay('equipment', content, this.equippedItem()),
        name: this.displayName(),
      };
    }

    return undefined;
  });

  // The paperdoll slots this piece of gear occupies (e.g. a two-handed
  // weapon occupies both Weapon + Offhand).
  public occupiedPaperdollSlots = computed<EquipmentSlot[]>(() => {
    const content = this.equippedContent();
    return content ? EquipmentTypeToSlot[content.type] : [];
  });

  public isSecondarySlot = computed<boolean>(() => {
    const content = this.equippedContent();
    if (!content || EquipmentTypeToSlot[content.type].length <= 1) return false;

    return EquipmentTypeToSlot[content.type][0] !== this.slot();
  });
}
