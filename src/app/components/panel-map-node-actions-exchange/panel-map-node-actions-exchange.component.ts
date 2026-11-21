import { FFButtonComponent } from '@ff/components/button/button.component';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type { ExchangeNodeContent } from '@interfaces/content-exchangenode';

@Component({
  selector: 'app-panel-map-node-actions-exchange',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FFButtonComponent],
  template: `
    <button
      type="button"
      class="btn btn-block btn-sm btn-primary"
      (click)="open.emit()"
      ffButton="ui-click"
      ffPadAction="context"
      ffPadLabel="Open"
    >
      {{ node().actionLabel }}
    </button>
  `,
})
export class PanelMapNodeActionsExchangeComponent {
  public node = input.required<ExchangeNodeContent>();

  public open = output<void>();
}
