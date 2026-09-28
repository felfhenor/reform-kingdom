import type { OnInit } from '@angular/core';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonConnectComponent } from '@components/button-connect/button-connect.component';
import { ButtonQuitComponent } from '@components/button-quit/button-quit.component';
import { ButtonSettingsComponent } from '@components/button-settings/button-settings.component';
import { ButtonUpdateComponent } from '@components/button-update/button-update.component';
import { PanelDebugButtonsComponent } from '@components/panel-debug-buttons/panel-debug-buttons.component';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { FadeInDirective } from '@directives/fade-in.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportOutletDirective } from '@directives/teleport.outlet.directive';
import {
  discordSetMainStatus,
  discordSetStatus,
} from '@helpers/engine/discord';
import { modalOpen } from '@helpers/engine/modal-stack';
import { gameReset } from '@helpers/game-init';
import { savefileBackupsRead } from '@helpers/savefile/savefile-backup-storage';
import {
  savefileFailureMessage,
  savefileLoadStatus,
} from '@helpers/savefile/savefile-load';
import { isSetup } from '@helpers/setup';
import { getOption, setOption } from '@helpers/state-options';
import { MetaService } from '@services/meta.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

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
    PanelDebugButtonsComponent,
  ],
  providers: [],
  hostDirectives: [FadeInDirective],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  public meta = inject(MetaService);
  private router = inject(Router);

  public resetGameSwal = viewChild<SwalComponent>('newGameSwal');
  public replaceUnloadableSwal = viewChild<SwalComponent>(
    'replaceUnloadableSwal',
  );

  public hasStartedGame = computed(() => isSetup());

  public analyticsEnabled = computed(() => getOption('analyticsEnabled'));

  public savefileFailureText = computed(() => {
    const status = savefileLoadStatus();
    return status.state === 'failed'
      ? savefileFailureMessage(status.reason)
      : '';
  });

  private hasBackups = signal(false);

  // A missing save with backups around is exactly what a silently lost save looks like.
  public showBackupsAvailable = computed(
    () =>
      this.hasBackups() &&
      !this.hasStartedGame() &&
      !this.savefileFailureText(),
  );

  openSavefileSettings(): void {
    setOption('optionsTab', 'Savefile');
    modalOpen('settings');
  }

  openAnalyticsSettings(): void {
    setOption('optionsTab', 'Misc');
    modalOpen('settings');
  }

  ngOnInit() {
    void savefileBackupsRead().then(({ backups }) =>
      this.hasBackups.set(backups.length > 0),
    );

    discordSetMainStatus('');
    discordSetStatus({
      state: 'In Main Menu',
    });
  }

  async newGame() {
    if (this.savefileFailureText()) {
      const res = await this.replaceUnloadableSwal()?.fire();
      if (!res?.isConfirmed) return;

      gameReset();
      this.router.navigate(['/setup']);
      return;
    }

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
