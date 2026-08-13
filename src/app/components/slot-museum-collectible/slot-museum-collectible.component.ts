import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import type { MuseumCollectibleEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const MAX_DISPLAY_QUANTITY = 9999;

@Component({
  selector: 'app-slot-museum-collectible',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './slot-museum-collectible.component.html',
  styleUrl: './slot-museum-collectible.component.scss',
})
export class SlotMuseumCollectibleComponent {
  public entry = input.required<MuseumCollectibleEntry>();

  public displayQuantity = computed(() => {
    const quantity = this.entry().quantity;
    return quantity > MAX_DISPLAY_QUANTITY
      ? `${MAX_DISPLAY_QUANTITY}+`
      : `${quantity}`;
  });
}
