import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import {
  IconStatComponent,
  STAT_SHORTHAND,
} from '@components/icon-stat/icon-stat.component';
import { defaultStats, getEntry } from '@helpers';
import {
  EquipmentTypeToSlot,
  type BaseStat,
  type EquipmentContent,
  type EquipmentId,
  type EquipmentSlot,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-equipment-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconStatComponent,
    StatDisplayPipe,
    TippyDirective,
  ],
  templateUrl: './equipment-slot.component.html',
  styleUrl: './equipment-slot.component.scss',
})
export class EquipmentSlotComponent {
  public slot = input.required<EquipmentSlot>();
  public equippedId = input<EquipmentId>();
  public isSelected = input<boolean>(false);

  public slotClick = output<void>();

  public statKeys = Object.keys(defaultStats()) as BaseStat[];
  public statShorthand = STAT_SHORTHAND;

  public equippedContent = computed(() => {
    const id = this.equippedId();
    if (!id) return undefined;

    const entry = getEntry<EquipmentContent>(id);
    return entry
      ? {
          ...entry,
          slots: EquipmentTypeToSlot[entry.type],
        }
      : undefined;
  });

  public isSecondarySlot = computed<boolean>(() => {
    const content = this.equippedContent();
    if (!content || EquipmentTypeToSlot[content.type].length <= 1) return false;

    return EquipmentTypeToSlot[content.type][0] !== this.slot();
  });

  public statValue(stat: BaseStat): number {
    return this.equippedContent()?.baseStats[stat] ?? 0;
  }
}
