import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { getEntry } from '@helpers/content';
import { isInfusionMaterial } from '@helpers/infusion';
import type { ItemContent, ItemId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-infused-materials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    RowItemStatsComponent,
    TippyDirective,
  ],
  templateUrl: './row-infused-materials.component.html',
  styleUrl: './row-infused-materials.component.scss',
})
export class RowInfusedMaterialsComponent {
  public infusedItemIds = input.required<(ItemId | null)[]>();
  public maxSlots = input.required<number>();
  // Optional - set to make slots clickable (used by the Infusion page to
  // pick a target slot). Purely visual/read-only when left unset.
  public selectedSlotIndex = input<number>();
  public slotClick = output<number>();

  public slots = computed(() =>
    Array.from({ length: this.maxSlots() }, (_, index) => {
      const itemId = this.infusedItemIds()[index] ?? null;
      return {
        index,
        content: itemId ? getEntry<ItemContent>(itemId) : undefined,
      };
    }),
  );

  public isInfusable(content: ItemContent): boolean {
    return isInfusionMaterial(content);
  }
}
