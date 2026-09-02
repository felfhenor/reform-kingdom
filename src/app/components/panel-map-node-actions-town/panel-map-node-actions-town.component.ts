import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';

@Component({
  selector: 'app-panel-map-node-actions-town',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  templateUrl: './panel-map-node-actions-town.component.html',
  styleUrl: './panel-map-node-actions-town.component.scss',
})
export class PanelMapNodeActionsTownComponent {
  public openTown = output<void>();
}
