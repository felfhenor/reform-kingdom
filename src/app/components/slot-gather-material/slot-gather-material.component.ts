import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { getEntry, isMaterialDiscovered } from '@helpers';
import type { ItemContent, ItemId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-gather-material',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './slot-gather-material.component.html',
  styleUrl: './slot-gather-material.component.scss',
})
export class SlotGatherMaterialComponent {
  public itemId = input.required<ItemId>();

  public item = computed(() => getEntry<ItemContent>(this.itemId()));
  public isDiscovered = computed(() => isMaterialDiscovered(this.itemId()));
}
