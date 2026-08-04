import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { getEntry, isMaterialDiscovered } from '@helpers';
import type { ItemContent, ItemId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-gather-material-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './gather-material-slot.component.html',
  styleUrl: './gather-material-slot.component.scss',
})
export class GatherMaterialSlotComponent {
  public itemId = input.required<ItemId>();

  public item = computed(() => getEntry<ItemContent>(this.itemId()));
  public isDiscovered = computed(() => isMaterialDiscovered(this.itemId()));
}
