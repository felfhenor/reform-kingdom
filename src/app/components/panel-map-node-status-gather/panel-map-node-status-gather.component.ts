import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';

@Component({
  selector: 'app-panel-map-node-status-gather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, BarProgressComponent],
  templateUrl: './panel-map-node-status-gather.component.html',
  styleUrl: './panel-map-node-status-gather.component.scss',
})
export class PanelMapNodeStatusGatherComponent {
  public gatherProgressPercent = input.required<number>();
}
