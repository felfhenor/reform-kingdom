import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { nodeBackgroundURL } from '@helpers/world-node/world-node-background.ui';
import type { NodeBackground, NodeBackgroundFilter } from '@interfaces';

@Component({
  selector: 'app-backdrop-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styleUrl: './backdrop-node.component.scss',
  host: {
    '[class.node-backdrop-clear]': 'clear()',
    '[class.node-backdrop-top]': "align() === 'top'",
    '[class]': 'filterClass()',
    '[style.background-image]': 'image()',
  },
})
export class BackdropNodeComponent {
  public background = input.required<NodeBackground>();
  public filter = input<NodeBackgroundFilter>('None');
  public clear = input(false);
  public align = input<'center' | 'top'>('center');

  public filterClass = computed(() => `bg-filter-${this.filter()}`);
  public image = computed(
    () => `url('${nodeBackgroundURL(this.background())}')`,
  );
}
