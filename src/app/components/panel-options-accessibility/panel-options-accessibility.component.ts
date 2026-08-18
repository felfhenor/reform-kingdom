import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@components/icon/icon.component';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { TippyDirective } from '@ngneat/helipopper';
import { NgSelectComponent } from '@ng-select/ng-select';

type MapZoomChoice = { label: string; value: number };

@Component({
  selector: 'app-panel-options-accessibility',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, TippyDirective, NgSelectComponent],
  templateUrl: './panel-options-accessibility.component.html',
  styleUrl: './panel-options-accessibility.component.scss',
})
export class PanelOptionsAccessibilityComponent extends OptionsBaseComponent {
  public readonly mapZoomChoices: MapZoomChoice[] = [
    { label: '100%', value: 1 },
    { label: '125%', value: 1.25 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2 },
  ];

  public mapZoom = signal<number>(this.getOption('mapZoom'));
}
