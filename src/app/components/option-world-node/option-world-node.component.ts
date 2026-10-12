import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import type { ExploreNodeFarmOption } from '@interfaces';

@Component({
  selector: 'app-option-world-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2' },
  imports: [SpriteNodeComponent],
  template: `
    <app-sprite-node class="zoom-row" [entry]="option().entry" />
    @if (showLevel()) {
      <div>
        <div class="type-label">{{ option().nodeName }}</div>
        <div class="type-meta text-difficulty-{{ option().difficulty }}">
          Lv. {{ option().levelLabel }}
        </div>
      </div>
    } @else {
      {{ option().nodeName }}
    }
  `,
})
export class OptionWorldNodeComponent {
  public option = input.required<ExploreNodeFarmOption>();
  public showLevel = input(false);
}
