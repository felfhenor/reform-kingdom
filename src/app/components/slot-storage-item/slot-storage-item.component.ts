import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { BadgeInfusableComponent } from '@components/badge-infusable/badge-infusable.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { isInfusionMaterial } from '@helpers/infusion';
import { itemPreviewDisplay } from '@helpers/item-preview';
import type { StorageMaterialEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const MAX_DISPLAY_QUANTITY = 9999;

@Component({
  selector: 'app-slot-storage-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    BadgeInfusableComponent,
    TooltipItemPreviewComponent,
    TippyDirective,
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

  public display = computed(() => itemPreviewDisplay(this.entry().item, 'item'));
}
