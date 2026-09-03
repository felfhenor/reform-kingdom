import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  townReputationTier,
  townReputationTierName,
} from '@helpers/town/reputation/town-reputation';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-badges-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './panel-map-node-badges-town.component.html',
  styleUrl: './panel-map-node-badges-town.component.scss',
})
export class PanelMapNodeBadgesTownComponent {
  public entry = input.required<WorldNodeEntry>();

  public scaleType = computed(() => worldNodeTown(this.entry())?.scaleType);

  public reputationTierName = computed(() => {
    const town = worldNodeTown(this.entry());
    return town ? townReputationTierName(townReputationTier(town.id)) : undefined;
  });
}
