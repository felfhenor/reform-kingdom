import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { getEntry } from '@helpers/content/content';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import type { EquipmentContent, EquipmentItem } from '@interfaces';

@Component({
  selector: 'app-row-equipment-item-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotRarityOutlineComponent],
  host: { class: 'contents' },
  template: `
    @let itemContent = content();

    @if (itemContent) {
      <app-slot-rarity-outline
        [entry]="itemContent"
        spritesheet="equipment"
      ></app-slot-rarity-outline>

      <div class="flex flex-col min-w-0">
        <span class="type-entity-name truncate text-{{ itemContent.rarity }}">
          {{ displayName() }}
        </span>

        <span class="type-meta"><ng-content /></span>
      </div>
    }
  `,
})
export class RowEquipmentItemSummaryComponent {
  public item = input.required<EquipmentItem>();

  public content = computed(() =>
    getEntry<EquipmentContent>(this.item().equipmentId),
  );

  public displayName = computed(() => {
    const content = this.content();
    return content ? equipmentItemDisplayName(this.item(), content.name) : '';
  });
}
