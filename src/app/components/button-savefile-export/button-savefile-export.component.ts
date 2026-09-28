import { Component } from '@angular/core';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { savefileExportDownload } from '@helpers/savefile/savefile-load.ui';
import { gamestate } from '@helpers/state-game';

@Component({
  selector: 'app-button-savefile-export',
  imports: [AnalyticsClickDirective, SFXDirective],
  templateUrl: './button-savefile-export.component.html',
  styleUrl: './button-savefile-export.component.scss',
})
export class ButtonSavefileExportComponent {
  exportSavefile() {
    savefileExportDownload(gamestate(), `${Date.now()}.rek`);
  }
}
