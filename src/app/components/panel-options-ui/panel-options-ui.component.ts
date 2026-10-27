import { DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { defaultOptions } from '@helpers/state-options';
import type { AdventureLogEntryKind } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-options-ui',
  imports: [DecimalPipe, IconComponent, TippyDirective],
  templateUrl: './panel-options-ui.component.html',
  styleUrl: './panel-options-ui.component.scss',
})
export class PanelOptionsUIComponent extends OptionsBaseComponent {
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
