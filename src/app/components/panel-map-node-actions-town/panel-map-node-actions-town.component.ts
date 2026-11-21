import { FFButtonComponent } from '@ff/components/button/button.component';
import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-panel-map-node-actions-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FFButtonComponent],
  templateUrl: './panel-map-node-actions-town.component.html',
  styleUrl: './panel-map-node-actions-town.component.scss',
})
export class PanelMapNodeActionsTownComponent {
  public openTown = output<void>();
}
