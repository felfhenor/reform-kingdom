import { DatePipe, formatNumber } from '@angular/common';
import { Component, computed, inject, LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonSavefileExportComponent } from '@components/button-savefile-export/button-savefile-export.component';
import { ButtonSavefileImportComponent } from '@components/button-savefile-import/button-savefile-import.component';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { ticksToDurationParts, timerTicksElapsed } from '@helpers/engine/timer';
import { gameReset } from '@helpers/game-init';
import { gamestate } from '@helpers/state-game';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-panel-options-savefile',
  imports: [
    SweetAlert2Module,
    DatePipe,
    ButtonSavefileExportComponent,
    ButtonSavefileImportComponent,
    AnalyticsClickDirective,
    SFXDirective,
  ],
  templateUrl: './panel-options-savefile.component.html',
  styleUrl: './panel-options-savefile.component.scss',
})
export class PanelOptionsSavefileComponent {
  private router = inject(Router);
  private locale = inject(LOCALE_ID);

  public startedAt = computed(() => gamestate().meta.createdAt);
  public elapsedDurationText = computed(() =>
    ticksToDurationParts(timerTicksElapsed())
      .map(
        (part) =>
          `${formatNumber(part.value, this.locale)} ${part.unit}${part.value === 1 ? '' : 's'}`,
      )
      .join(', '),
  );

  async deleteSavefile() {
    await this.router.navigate(['/']);

    gameReset();
  }
}
