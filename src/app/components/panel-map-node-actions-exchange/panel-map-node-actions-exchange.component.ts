import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';
import type { ExchangeNodeContent } from '@interfaces/content-exchangenode';

@Component({
  selector: 'app-panel-map-node-actions-exchange',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  template: `
    <button
      type="button"
      class="btn btn-block btn-sm btn-primary"
      (click)="open.emit()"
      appSfx="ui-click"
      [sfxTrigger]="['click', 'hover']"
    >
      {{ node().actionLabel }}
    </button>
  `,
})
export class PanelMapNodeActionsExchangeComponent {
  public node = input.required<ExchangeNodeContent>();

  public open = output<void>();
}
