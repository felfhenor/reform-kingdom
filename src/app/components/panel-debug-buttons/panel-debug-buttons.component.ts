import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonContentAnalysisComponent } from '@components/button-content-analysis/button-content-analysis.component';
import { ButtonIconsComponent } from '@components/button-icons/button-icons.component';

@Component({
  selector: 'app-panel-debug-buttons',
  imports: [ButtonContentAnalysisComponent, ButtonIconsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-debug-buttons.component.html',
  styleUrl: './panel-debug-buttons.component.scss',
})
export class PanelDebugButtonsComponent {}
