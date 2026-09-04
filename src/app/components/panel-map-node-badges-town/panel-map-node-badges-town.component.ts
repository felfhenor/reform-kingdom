import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { townRaidTelegraph } from '@helpers/town/raid/town-raid-state';
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
    return town
      ? townReputationTierName(townReputationTier(town.id))
      : undefined;
  });

  public raidCountdown = computed(() => {
    const town = worldNodeTown(this.entry());
    const telegraph = town ? townRaidTelegraph(town.id) : undefined;
    if (!telegraph) return undefined;

    return formatDuration(
      telegraph.engageWindowExpiresAtTick - timerTicksElapsed(),
    );
  });
}
