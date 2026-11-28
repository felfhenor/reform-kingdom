import { TPipe } from '@pipes/t.pipe';
import { FFButtonComponent } from '@ff/components/button/button.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { exchangeNodeActionLabel } from '@helpers/exchange/exchange.ui';
import type { ExchangeNodeContent } from '@interfaces/content-exchangenode';

@Component({
  selector: 'app-panel-map-node-actions-exchange',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, FFButtonComponent],
  template: `
    <button
      type="button"
      class="btn btn-block btn-sm btn-primary"
      (click)="open.emit()"
      ffButton="ui-click"
      ffPadAction="context"
      [ffPadLabel]="'panelMapNodeActionsExchange.open' | t"
    >
      {{ actionLabel() }}
    </button>
  `,
})
export class PanelMapNodeActionsExchangeComponent {
  public node = input.required<ExchangeNodeContent>();
  public actionLabel = computed(() => exchangeNodeActionLabel(this.node()));

  public open = output<void>();
}
