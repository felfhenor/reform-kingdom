import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { InfusedMaterialsRowComponent } from '@components/infused-materials-row/infused-materials-row.component';
import { ItemStatRowsComponent } from '@components/item-stat-rows/item-stat-rows.component';
import { equipmentItemInfusionBonus, getEntry } from '@helpers';
import {
  EquipmentTypeToSlot,
  type EquipmentContent,
  type EquipmentItem,
  type EquipmentSkillContent,
  type EquipmentSlot,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-equipment-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    InfusedMaterialsRowComponent,
    ItemStatRowsComponent,
    TippyDirective,
  ],
  templateUrl: './equipment-slot.component.html',
  styleUrl: './equipment-slot.component.scss',
})
export class EquipmentSlotComponent {
  public slot = input.required<EquipmentSlot>();
  public equippedItem = input<EquipmentItem>();
  public isSelected = input<boolean>(false);

  public slotClick = output<void>();

  public equippedContent = computed(() => {
    const equipmentId = this.equippedItem()?.equipmentId;
    if (!equipmentId) return undefined;

    return getEntry<EquipmentContent>(equipmentId);
  });

  public infusionBonus = computed(() =>
    equipmentItemInfusionBonus(this.equippedItem()?.infusedItemIds ?? []),
  );

  // The paperdoll slots this piece of gear occupies (e.g. a two-handed
  // weapon occupies both Weapon + Offhand) - distinct from
  // `EquipmentContent.slots`, which is the *infusion* slot count.
  public occupiedPaperdollSlots = computed<EquipmentSlot[]>(() => {
    const content = this.equippedContent();
    return content ? EquipmentTypeToSlot[content.type] : [];
  });

  public grantedSkills = computed<EquipmentSkillContent[]>(() => {
    const content = this.equippedContent();
    if (!content) return [];

    return content.grantedSkillIds
      .map((skillId) => getEntry<EquipmentSkillContent>(skillId))
      .filter((skill): skill is EquipmentSkillContent => !!skill);
  });

  public isSecondarySlot = computed<boolean>(() => {
    const content = this.equippedContent();
    if (!content || EquipmentTypeToSlot[content.type].length <= 1) return false;

    return EquipmentTypeToSlot[content.type][0] !== this.slot();
  });
}
