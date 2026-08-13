import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { worldNodeGatherTime } from '@helpers';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-badges-gather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './panel-map-node-badges-gather.component.html',
  styleUrl: './panel-map-node-badges-gather.component.scss',
})
export class PanelMapNodeBadgesGatherComponent {
  public entry = input.required<WorldNodeEntry>();

  public gatherTime = computed(() => worldNodeGatherTime(this.entry()));
}
