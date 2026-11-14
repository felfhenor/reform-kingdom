import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { worldNodeSpriteFrame } from '@helpers/world-node/world-node-content.ui';
import type { WorldNodeEntry } from '@interfaces';

// A node's map tile cropped from its tileset, shared by anywhere a node needs to show its icon off-map.
@Component({
  selector: 'app-sprite-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'overflow-hidden shrink-0 inline-block',
    '[class.bg-base-200]': 'framed()',
  },
  template: `
    @if (spriteFrame(); as frame) {
      <img
        [src]="frame.imagePath"
        alt=""
        class="object-none select-none [image-rendering:pixelated]"
        [style.width.px]="frame.width"
        [style.height.px]="frame.height"
        [style.object-position]="'-' + frame.x + 'px -' + frame.y + 'px'"
        draggable="false"
      />
    }
  `,
})
export class SpriteNodeComponent {
  public entry = input.required<WorldNodeEntry>();
  // Off where the node sits on its own backdrop, which the frame would cover.
  public framed = input(true);

  public spriteFrame = computed(() => worldNodeSpriteFrame(this.entry()));
}
