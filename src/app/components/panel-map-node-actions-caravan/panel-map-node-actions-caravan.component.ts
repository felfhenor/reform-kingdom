import { TPipe } from '@pipes/t.pipe';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-panel-map-node-actions-caravan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, FFButtonComponent],
  templateUrl: './panel-map-node-actions-caravan.component.html',
  styleUrl: './panel-map-node-actions-caravan.component.scss',
})
export class PanelMapNodeActionsCaravanComponent {
  public openTrade = output<void>();
}
