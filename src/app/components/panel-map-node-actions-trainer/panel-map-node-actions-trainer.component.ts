import { FFButtonComponent } from '@ff/components/button/button.component';
import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-panel-map-node-actions-trainer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FFButtonComponent],
  template: `
    <button
      type="button"
      class="btn btn-block btn-sm btn-primary"
      (click)="visit.emit()"
      ffButton="ui-click"
      ffPadAction="context"
      ffPadLabel="Visit Trainer"
    >
      Visit
    </button>
  `,
})
export class PanelMapNodeActionsTrainerComponent {
  public visit = output<void>();
}
