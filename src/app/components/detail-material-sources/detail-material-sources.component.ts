import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  materialSourceIsCrafting,
  materialSourceNodeNames,
} from '@helpers/item/material-source.ui';
import type { ItemId } from '@interfaces';

@Component({
  selector: 'app-detail-material-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (nodeNames().length > 0 || isCrafted()) {
      <div class="type-meta mt-2">
        @if (nodeNames().length > 0) {
          <div>Found in: {{ nodeNames().join(', ') }}</div>
        }
        @if (isCrafted()) {
          <div>Source: Crafting</div>
        }
      </div>
    }
  `,
})
export class DetailMaterialSourcesComponent {
  public itemId = input.required<ItemId>();

  public nodeNames = computed(() => materialSourceNodeNames(this.itemId()));
  public isCrafted = computed(() => materialSourceIsCrafting(this.itemId()));
}
