import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { BadgeInfusableComponent } from '@components/badge-infusable/badge-infusable.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { isInfusionMaterial } from '@helpers/item/infusion';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import type { StorageMaterialEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const MAX_DISPLAY_QUANTITY = 9999;

@Component({
  selector: 'app-slot-storage-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeInfusableComponent,
    TooltipItemPreviewComponent,
    TippyDirective,
    DecimalPipe,
    SlotRarityOutlineComponent,
  ],
  templateUrl: './slot-storage-item.component.html',
  styleUrl: './slot-storage-item.component.scss',
})
export class SlotStorageItemComponent {
  public entry = input.required<StorageMaterialEntry>();

  public displayQuantity = computed(() => {
    const quantity = this.entry().quantity;
    return quantity > MAX_DISPLAY_QUANTITY
      ? `${MAX_DISPLAY_QUANTITY}+`
      : `${quantity}`;
  });

  public isInfusable = computed(() => isInfusionMaterial(this.entry().item));

  public display = computed(() =>
    itemPreviewDisplay(this.entry().item, 'item'),
  );
}
