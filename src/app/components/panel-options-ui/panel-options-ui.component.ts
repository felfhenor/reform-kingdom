import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { defaultOptions } from '@helpers/state-options';
import type { AdventureLogEntryKind } from '@interfaces';

@Component({
  selector: 'app-panel-options-ui',
  imports: [FormsModule, TitleCasePipe, DecimalPipe],
  templateUrl: './panel-options-ui.component.html',
  styleUrl: './panel-options-ui.component.scss',
})
export class PanelOptionsUIComponent extends OptionsBaseComponent {
  public currentTheme = signal<string>(this.getOption('uiTheme') as string);

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

  public readonly themes = [
    { name: 'acid', type: 'light' },
    { name: 'autumn', type: 'light' },
    {
      name: 'black',
      type: 'dark',
    },
    { name: 'bumblebee', type: 'light' },
    {
      name: 'business',
      type: 'dark',
    },
    {
      name: 'coffee',
      type: 'dark',
    },
    { name: 'cmyk', type: 'light' },
    { name: 'corporate', type: 'light' },
    { name: 'cupcake', type: 'light' },
    { name: 'cyberpunk', type: 'light' },
    {
      name: 'dark',
      type: 'dark',
    },
    {
      name: 'dim',
      type: 'dark',
    },
    {
      name: 'dracula',
      type: 'dark',
    },
    { name: 'emerald', type: 'light' },
    { name: 'fantasy', type: 'light' },
    {
      name: 'forest',
      type: 'dark',
    },
    { name: 'garden', type: 'light' },
    {
      name: 'halloween',
      type: 'dark',
    },
    { name: 'lemonade', type: 'light' },
    { name: 'light', type: 'light' },
    { name: 'lofi', type: 'light' },
    {
      name: 'luxury',
      type: 'dark',
    },
    {
      name: 'night',
      type: 'dark',
    },
    { name: 'nord', type: 'light' },
    { name: 'pastel', type: 'light' },
    { name: 'retro', type: 'light' },
    {
      name: 'sunset',
      type: 'dark',
    },
    { name: 'synthwave', type: 'dark' },
    { name: 'valentine', type: 'light' },
    { name: 'winter', type: 'light' },
    { name: 'wireframe', type: 'light' },
  ].filter((t) => t.type !== 'light');
}
