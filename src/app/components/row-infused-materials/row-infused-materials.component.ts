import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { isInfusionMaterial } from '@helpers/item/infusion';
import { type ItemContent, type ItemId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-infused-materials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    RowStatSummaryComponent,
    TippyDirective,
    SFXDirective,
  ],
  templateUrl: './row-infused-materials.component.html',
  styleUrl: './row-infused-materials.component.scss',
})
export class RowInfusedMaterialsComponent {
  public infusedItemIds = input.required<(ItemId | null)[]>();
  public maxSlots = input.required<number>();
  public selectable = input<boolean>(false);
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
