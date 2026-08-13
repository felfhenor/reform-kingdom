import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';

@Component({
  selector: 'app-map-node-panel-actions-caravan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  templateUrl: './map-node-panel-actions-caravan.component.html',
  styleUrl: './map-node-panel-actions-caravan.component.scss',
})
export class MapNodePanelActionsCaravanComponent {
  public openTrade = output<void>();
}
