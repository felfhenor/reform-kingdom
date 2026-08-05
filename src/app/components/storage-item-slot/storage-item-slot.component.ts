import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import type { StorageMaterialEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const MAX_DISPLAY_QUANTITY = 9999;

@Component({
  selector: 'app-storage-item-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, IconBlankSlotComponent, TippyDirective],
  templateUrl: './storage-item-slot.component.html',
  styleUrl: './storage-item-slot.component.scss',
})
export class StorageItemSlotComponent {
  public entry = input.required<StorageMaterialEntry>();

  public displayQuantity = computed(() => {
    const quantity = this.entry().quantity;
    return quantity > MAX_DISPLAY_QUANTITY
      ? `${MAX_DISPLAY_QUANTITY}+`
      : `${quantity}`;
  });
}
