import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  worldNodeShrineLegendVerseCount,
  worldNodeShrineLegendVerses,
} from '@helpers/world-node/world-node-shrine.ui';
import { worldNodeShrine } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-legend-shrine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-map-node-legend-shrine.component.html',
  styleUrl: './panel-map-node-legend-shrine.component.scss',
})
export class PanelMapNodeLegendShrineComponent {
  public entry = input.required<WorldNodeEntry>();

  private shrine = computed(() => worldNodeShrine(this.entry()));

  public legendName = computed(() => {
    const shrine = this.shrine();
    return shrine ? shrine.legendName : '';
  });

  private totalVerses = computed(() => {
    const shrine = this.shrine();
    return shrine ? worldNodeShrineLegendVerseCount(shrine) : 0;
  });

  public verses = computed(() => {
    const shrine = this.shrine();
    return shrine
      ? worldNodeShrineLegendVerses(shrine, this.entry().nodeName)
      : [];
  });

  public hasLegend = computed(() => this.totalVerses() > 0);

  public hasMoreVerses = computed(
    () => this.verses().length < this.totalVerses(),
  );
}
