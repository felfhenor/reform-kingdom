import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-map-node-panel-actions-gather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './map-node-panel-actions-gather.component.html',
  styleUrl: './map-node-panel-actions-gather.component.scss',
})
export class MapNodePanelActionsGatherComponent {
  public gatherProgressPercent = input.required<number>();
}
