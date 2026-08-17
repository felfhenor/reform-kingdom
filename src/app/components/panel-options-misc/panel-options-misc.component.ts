import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-options-misc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TippyDirective],
  templateUrl: './panel-options-misc.component.html',
  styleUrl: './panel-options-misc.component.scss',
})
export class PanelOptionsMiscComponent extends OptionsBaseComponent {}
