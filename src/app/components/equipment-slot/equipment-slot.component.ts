import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { ContentNameComponent } from '@components/content-name/content-name.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconStatComponent, STAT_SHORTHAND } from '@components/icon-stat/icon-stat.component';
import { defaultStats, getEntry } from '@helpers';
import type { BaseStat, EquipmentContent, EquipmentId, EquipmentSlot } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-equipment-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    ContentNameComponent,
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

  public equippedContent = computed<EquipmentContent | undefined>(() => {
    const id = this.equippedId();
    return id ? getEntry<EquipmentContent>(id) : undefined;
  });

  public isSecondarySlot = computed<boolean>(() => {
    const content = this.equippedContent();
    if (!content || content.slots.length <= 1) return false;

    return content.slots[0] !== this.slot();
  });

  public statValue(stat: BaseStat): number {
    return this.equippedContent()?.baseStats[stat] ?? 0;
  }
}
