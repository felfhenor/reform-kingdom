import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { getEntry } from '@helpers/content';
import { defaultCombatStats, defaultStats, defaultTagResistances } from '@helpers/defaults';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
  equipmentItemGrantedSkills,
} from '@helpers/item/equipment-display';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import {
  EquipmentTypeToSlot,
  type EquipmentContent,
  type EquipmentItem,
  type EquipmentSkillContent,
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
    RowStatSummaryComponent,
    TippyDirective,
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
    return item && content
      ? equipmentItemDisplayName(item, content.name)
      : '';
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

  // The paperdoll slots this piece of gear occupies (e.g. a two-handed
  // weapon occupies both Weapon + Offhand) - distinct from
  // `EquipmentContent.slots`, which is the *infusion* slot count.
  public occupiedPaperdollSlots = computed<EquipmentSlot[]>(() => {
    const content = this.equippedContent();
    return content ? EquipmentTypeToSlot[content.type] : [];
  });

  public grantedSkills = computed<EquipmentSkillContent[]>(() => {
    const item = this.equippedItem();
    const content = this.equippedContent();
    if (!item || !content) return [];

    return equipmentItemGrantedSkills(item, content);
  });

  public isSecondarySlot = computed<boolean>(() => {
    const content = this.equippedContent();
    if (!content || EquipmentTypeToSlot[content.type].length <= 1) return false;

    return EquipmentTypeToSlot[content.type][0] !== this.slot();
  });
}
