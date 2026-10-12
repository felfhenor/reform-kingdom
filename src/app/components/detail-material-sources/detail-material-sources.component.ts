import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import {
  materialSourceIsCrafting,
  materialSourceNodes,
} from '@helpers/item/material-source.ui';
import type { ItemId } from '@interfaces';

@Component({
  selector: 'app-detail-material-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpriteNodeComponent],
  template: `
    @if (nodes().length > 0 || isCrafted()) {
      <div class="type-meta mt-2">
        @if (nodes().length > 0) {
          <div>Found in:</div>
          <div class="flex flex-col gap-1 my-1 ml-2">
            @for (node of nodes(); track node.nodeName) {
              <div class="flex items-center gap-2">
                <app-sprite-node class="zoom-inline" [entry]="node" />
                {{ node.nodeName }}
              </div>
            }
          </div>
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

  public nodes = computed(() => materialSourceNodes(this.itemId()));
  public isCrafted = computed(() => materialSourceIsCrafting(this.itemId()));
}
