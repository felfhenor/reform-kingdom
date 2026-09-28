import { DatePipe, DecimalPipe, formatNumber } from '@angular/common';
import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonSavefileExportComponent } from '@components/button-savefile-export/button-savefile-export.component';
import { ButtonSavefileImportComponent } from '@components/button-savefile-import/button-savefile-import.component';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { SAVEFILE_BACKUP_MAX } from '@helpers/config';
import { isInElectron } from '@helpers/engine/discord';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { ticksToDurationParts } from '@helpers/engine/timer.ui';
import { closeAllMenus } from '@helpers/engine/ui';
import { gameReset } from '@helpers/game-init';
import { savefileBackupsRead } from '@helpers/savefile/savefile-backup-storage';
import {
  savefileFailureMessage,
  savefileLoadStatus,
} from '@helpers/savefile/savefile-load';
import {
  savefileBackupsResetUnreadable,
  savefileExportDownload,
  savefileRecover,
  savefileRestoreBackup,
} from '@helpers/savefile/savefile-load.ui';
import { gamestate } from '@helpers/state-game';
import type { SavefileBackup, SavefileBackupReason } from '@interfaces';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-panel-options-savefile',
  imports: [
    SweetAlert2Module,
    DatePipe,
    DecimalPipe,
    ButtonSavefileExportComponent,
    ButtonSavefileImportComponent,
    AnalyticsClickDirective,
    SFXDirective,
  ],
  templateUrl: './panel-options-savefile.component.html',
  styleUrl: './panel-options-savefile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelOptionsSavefileComponent implements OnInit {
  private router = inject(Router);
  private locale = inject(LOCALE_ID);

  private restoreSwal = viewChild<SwalComponent>('restoreSwal');
  private resetBackupsSwal = viewChild<SwalComponent>('resetBackupsSwal');

  public readonly maxBackups = SAVEFILE_BACKUP_MAX;
  public readonly writesToDisk = isInElectron();

  public backups = signal<SavefileBackup[]>([]);
  public hasLoadedBackups = signal(false);
  public backupsReadFailed = signal(false);
  public isBusy = signal(false);
  private pendingRestore = signal<SavefileBackup | undefined>(undefined);

  public loadFailure = computed(() => {
    const status = savefileLoadStatus();
    return status.state === 'failed' ? status : undefined;
  });

  public loadFailureMessage = computed(() => {
    const failure = this.loadFailure();
    return failure ? savefileFailureMessage(failure.reason) : '';
  });

  public startedAt = computed(() => gamestate().meta.createdAt);
  public elapsedDurationText = computed(() =>
    this.durationText(timerTicksElapsed()),
  );

  public readonly reasonLabels: Record<SavefileBackupReason, string> = {
    load: 'Before loading',
    import: 'Before importing',
    restore: 'Before restoring',
  };

  ngOnInit() {
    void this.refreshBackups();
  }

  public durationText(ticks: number): string {
    return ticksToDurationParts(ticks)
      .map(
        (part) =>
          `${formatNumber(part.value, this.locale)} ${part.unit}${part.value === 1 ? '' : 's'}`,
      )
      .join(', ');
  }

  private async refreshBackups() {
    const { backups, unreadableSources } = await savefileBackupsRead();
    this.backups.set(backups);
    this.backupsReadFailed.set(unreadableSources.length > 0);
    this.hasLoadedBackups.set(true);
  }

  private async runAction(action: () => Promise<boolean>) {
    if (this.isBusy()) return;

    this.isBusy.set(true);
    try {
      const succeeded = await action();
      await this.refreshBackups();
      if (!succeeded) return;

      closeAllMenus();
      await this.router.navigate(['/game']);
    } finally {
      this.isBusy.set(false);
    }
  }

  confirmRestore(backup: SavefileBackup) {
    this.pendingRestore.set(backup);
    void this.restoreSwal()?.fire();
  }

  async restorePendingBackup() {
    const backup = this.pendingRestore();
    if (!backup) return;

    this.pendingRestore.set(undefined);
    await this.runAction(() => savefileRestoreBackup(backup));
  }

  async recoverSavefile() {
    await this.runAction(() => savefileRecover());
  }

  confirmResetBackups() {
    void this.resetBackupsSwal()?.fire();
  }

  async resetUnreadableBackups() {
    if (this.isBusy()) return;

    this.isBusy.set(true);
    try {
      await savefileBackupsResetUnreadable();
      await this.refreshBackups();
    } finally {
      this.isBusy.set(false);
    }
  }

  reloadGame() {
    window.location.reload();
  }

  exportUnloadableSavefile() {
    const data = this.loadFailure()?.data;
    if (data === undefined) return;

    savefileExportDownload(data, `unloadable-${Date.now()}.rek`);
  }

  async deleteSavefile() {
    await this.router.navigate(['/']);

    gameReset();
  }
}
