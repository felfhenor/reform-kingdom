import type { OnInit } from '@angular/core';
import { Component, computed, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonConnectComponent } from '@components/button-connect/button-connect.component';
import { ButtonQuitComponent } from '@components/button-quit/button-quit.component';
import { ButtonSettingsComponent } from '@components/button-settings/button-settings.component';
import { ButtonUpdateComponent } from '@components/button-update/button-update.component';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
import { discordSetMainStatus, discordSetStatus } from '@helpers/discord';
import { gameReset } from '@helpers/game-init';
import { modalOpen } from '@helpers/modal-stack';
import { isSetup } from '@helpers/setup';
import { getOption, setOption } from '@helpers/state-options';
import { MetaService } from '@services/meta.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { ButtonContentAnalysisComponent } from '../../components/button-content-analysis/button-content-analysis.component';

@Component({
  selector: 'app-home',
  imports: [
    SweetAlert2Module,
    ButtonConnectComponent,
    AnalyticsClickDirective,
    SFXDirective,
    ButtonUpdateComponent,
    ButtonQuitComponent,
    TeleportOutletDirective,
    ButtonSettingsComponent,
    ButtonContentAnalysisComponent,
  ],
  providers: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  public meta = inject(MetaService);
  private router = inject(Router);

  public resetGameSwal = viewChild<SwalComponent>('newGameSwal');

  public hasStartedGame = computed(() => isSetup());

  public analyticsEnabled = computed(() => getOption('analyticsEnabled'));

  openAnalyticsSettings(): void {
    setOption('optionsTab', 'Misc');
    modalOpen('settings');
  }

  ngOnInit() {
    discordSetMainStatus('');
    discordSetStatus({
      state: 'In Main Menu',
    });
  }

  async newGame() {
    if (isSetup()) {
      const res = await this.resetGameSwal()?.fire();
      if (!res) return;

      if (res.isConfirmed) {
        gameReset();
        this.router.navigate(['/setup']);
      }
      return;
    }

    this.router.navigate(['/setup']);
  }

  resumeGame() {
    this.router.navigate(['/game']);
  }
}
