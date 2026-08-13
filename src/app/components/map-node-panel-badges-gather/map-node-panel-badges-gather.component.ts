import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { worldNodeGatherTime } from '@helpers';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-map-node-panel-badges-gather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './map-node-panel-badges-gather.component.html',
  styleUrl: './map-node-panel-badges-gather.component.scss',
})
export class MapNodePanelBadgesGatherComponent {
  public entry = input.required<WorldNodeEntry>();

  public gatherTime = computed(() => worldNodeGatherTime(this.entry()));
}
