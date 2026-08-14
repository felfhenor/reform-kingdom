import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { worldNodeSpriteFrame } from '@helpers/world-node-content';
import type { WorldNodeEntry } from '@interfaces';

// A node's map tile, cropped from its tileset - shared by anywhere a world
// node needs to show its own icon off-map (the node info popup, the Farm
// Node clause's node picker), rather than each caller re-deriving the crop
// via `worldNodeSpriteFrame` and re-implementing the image styling itself.
@Component({
  selector: 'app-sprite-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'overflow-hidden shrink-0 rounded-box bg-base-200 inline-block',
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

  public spriteFrame = computed(() => worldNodeSpriteFrame(this.entry()));
}
