import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';

@Component({
  selector: 'app-panel-map-node-actions-caravan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  templateUrl: './panel-map-node-actions-caravan.component.html',
  styleUrl: './panel-map-node-actions-caravan.component.scss',
})
export class PanelMapNodeActionsCaravanComponent {
  public openTrade = output<void>();
}
