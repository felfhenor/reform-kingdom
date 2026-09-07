import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ButtonContentAnalysisComponent } from '@components/button-content-analysis/button-content-analysis.component';
import { ButtonIconsComponent } from '@components/button-icons/button-icons.component';
import { getOption } from '@helpers/state-options';

@Component({
  selector: 'app-panel-debug-buttons',
  imports: [ButtonContentAnalysisComponent, ButtonIconsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-debug-buttons.component.html',
  styleUrl: './panel-debug-buttons.component.scss',
  host: {
    '[class.!hidden]': '!debugEnabled()',
  },
})
export class PanelDebugButtonsComponent {
  public debugEnabled = computed(() => getOption('showDebug'));
}
