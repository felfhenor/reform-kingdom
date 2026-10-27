import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@components/icon/icon.component';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { isMotionReducedBySystem } from '@helpers/engine/motion';
import type { MotionPreference, UiScale } from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';

type MapZoomChoice = { label: string; value: number };
type UiScaleChoice = { label: string; value: UiScale };
type MotionChoice = { label: string; value: MotionPreference };

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

  public readonly uiScaleChoices: UiScaleChoice[] = [
    { label: 'Auto', value: 'auto' },
    { label: '100%', value: 1 },
    { label: '125%', value: 1.25 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2 },
  ];

  public readonly motionChoices = computed<MotionChoice[]>(() => [
    {
      label: `Follow System (${isMotionReducedBySystem() ? 'On' : 'Off'})`,
      value: 'system',
    },
    { label: 'Reduced Motion (On)', value: 'reduced' },
    { label: 'Normal Motion (Off)', value: 'full' },
  ]);

  public mapZoom = signal<number>(this.getOption('mapZoom'));
  public uiScale = signal<UiScale>(this.getOption('uiScale'));
  public motionPreference = signal<MotionPreference>(
    this.getOption('motionPreference') ?? 'system',
  );
}
