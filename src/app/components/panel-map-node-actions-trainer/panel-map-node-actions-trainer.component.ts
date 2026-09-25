import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';

@Component({
  selector: 'app-panel-map-node-actions-trainer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  template: `
    <button
      type="button"
      class="btn btn-block btn-sm btn-primary"
      (click)="visit.emit()"
      appSfx="ui-click"
      [sfxTrigger]="['click', 'hover']"
    >
      Visit
    </button>
  `,
})
export class PanelMapNodeActionsTrainerComponent {
  public visit = output<void>();
}
