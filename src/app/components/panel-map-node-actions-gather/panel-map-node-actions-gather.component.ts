import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-panel-map-node-actions-gather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './panel-map-node-actions-gather.component.html',
  styleUrl: './panel-map-node-actions-gather.component.scss',
})
export class PanelMapNodeActionsGatherComponent {
  public gatherProgressPercent = input.required<number>();
}
