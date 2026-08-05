import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import {
  IconStatComponent,
  STAT_SHORTHAND,
} from '@components/icon-stat/icon-stat.component';
import { defaultStats } from '@helpers';
import type { BaseStat, EquipmentContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-armory-item-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconStatComponent,
    TippyDirective,
  ],
  templateUrl: './armory-item-slot.component.html',
  styleUrl: './armory-item-slot.component.scss',
})
export class ArmoryItemSlotComponent {
  public equipment = input.required<EquipmentContent>();

  public statKeys = Object.keys(defaultStats()) as BaseStat[];
  public statShorthand = STAT_SHORTHAND;

  public statValue(stat: BaseStat): number {
    return this.equipment().baseStats[stat] ?? 0;
  }
}
