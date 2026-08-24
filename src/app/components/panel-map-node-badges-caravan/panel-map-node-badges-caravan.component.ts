import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  worldNodeCaravanTradeCounts,
  worldNodeCaravanTraderLevel,
} from '@helpers/world-node/world-node-caravan';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-badges-caravan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './panel-map-node-badges-caravan.component.html',
  styleUrl: './panel-map-node-badges-caravan.component.scss',
})
export class PanelMapNodeBadgesCaravanComponent {
  public entry = input.required<WorldNodeEntry>();

  public traderLevel = computed(() =>
    worldNodeCaravanTraderLevel(this.entry()),
  );

  public tradeCounts = computed(() =>
    worldNodeCaravanTradeCounts(this.entry()),
  );
}
