import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { getEntry } from '@helpers/content';
import { equipmentItemInfusionBonus } from '@helpers/infusion';
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
    RowItemStatsComponent,
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
