import { DecimalPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@components/icon/icon.component';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { defaultOptions } from '@helpers/state-options';
import type { AdventureLogEntryKind } from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';

type FrameRateChoice = { label: string; value: number };

@Component({
  selector: 'app-panel-options-ui',
  imports: [
    DecimalPipe,
    FormsModule,
    IconComponent,
    NgSelectComponent,
    TippyDirective,
  ],
  templateUrl: './panel-options-ui.component.html',
  styleUrl: './panel-options-ui.component.scss',
})
export class PanelOptionsUIComponent extends OptionsBaseComponent {
  public readonly mapFrameRateChoices: FrameRateChoice[] = [
    { label: '15 FPS', value: 15 },
    { label: '30 FPS', value: 30 },
    { label: '60 FPS', value: 60 },
  ];

  public mapFrameRate = signal<number>(this.getOption('mapFrameRate'));

  // From the defaults, not the saved option, so kinds no longer in the game don't linger in the list.
  public readonly adventureLogKinds = Object.keys(
    defaultOptions().adventureLogOverlayKinds,
  ) as AdventureLogEntryKind[];

  public toggleAdventureLogOverlayKind(kind: AdventureLogEntryKind): void {
    const kinds = this.getOption('adventureLogOverlayKinds');
    this.setOption('adventureLogOverlayKinds', {
      ...kinds,
      [kind]: !kinds[kind],
    });
  }
}
