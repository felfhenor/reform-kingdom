import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import type { MuseumCollectibleEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const MAX_DISPLAY_QUANTITY = 9999;

@Component({
  selector: 'app-museum-collectible-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './museum-collectible-slot.component.html',
  styleUrl: './museum-collectible-slot.component.scss',
})
export class MuseumCollectibleSlotComponent {
  public entry = input.required<MuseumCollectibleEntry>();

  public displayQuantity = computed(() => {
    const quantity = this.entry().quantity;
    return quantity > MAX_DISPLAY_QUANTITY
      ? `${MAX_DISPLAY_QUANTITY}+`
      : `${quantity}`;
  });
}
