import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  worldNodeCaravanTradeCounts,
  worldNodeCaravanTraderLevel,
} from '@helpers';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-map-node-panel-badges-caravan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './map-node-panel-badges-caravan.component.html',
  styleUrl: './map-node-panel-badges-caravan.component.scss',
})
export class MapNodePanelBadgesCaravanComponent {
  public entry = input.required<WorldNodeEntry>();

  public traderLevel = computed(() => worldNodeCaravanTraderLevel(this.entry()));

  public tradeCounts = computed(() => worldNodeCaravanTradeCounts(this.entry()));
}
