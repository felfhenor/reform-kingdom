import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import { museumCollectibleSourceLabel } from '@helpers/kingdom/museum.ui';
import type { MuseumCollectibleEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const MAX_DISPLAY_QUANTITY = 9999;

@Component({
  selector: 'app-slot-museum-collectible',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DetailItemPreviewComponent,
    IconUnknownComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './slot-museum-collectible.component.html',
  styleUrl: './slot-museum-collectible.component.scss',
})
export class SlotMuseumCollectibleComponent {
  public entry = input.required<MuseumCollectibleEntry>();

  public display = computed(() =>
    itemPreviewDisplay('collectible', this.entry().collectible),
  );

  public sourceLabel = computed(() =>
    museumCollectibleSourceLabel(this.entry()),
  );

  public displayQuantity = computed(() => {
    const quantity = this.entry().quantity;
    return quantity > MAX_DISPLAY_QUANTITY
      ? `${MAX_DISPLAY_QUANTITY}+`
      : `${quantity}`;
  });
}
