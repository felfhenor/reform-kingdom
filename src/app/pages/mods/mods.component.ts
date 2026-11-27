import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { PanelModsModioComponent } from '@components/panel-mods-modio/panel-mods-modio.component';
import { FadeInDirective } from '@directives/fade-in.directive';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { notifyError, notifySuccess } from '@helpers/engine/notify';
import {
  modsDiskAvailable,
  modsDiskOpenFolder,
} from '@helpers/mod/mod-disk.ui';
import {
  modsAddToRun,
  modsImportZip,
  modsMoveEnabled,
  modsRemoveStored,
  modsSetEnabled,
} from '@helpers/mod/mod-install.ui';
import { modRefLabel, modsInstalled } from '@helpers/mod/mod-registry';
import { savefileLoadStatus } from '@helpers/savefile/savefile-load';
import { isSetup } from '@helpers/setup';
import { metaState } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { modioIsConfigured, modioUnsubscribe } from '@helpers/mod/modio.ui';
import type { ModInstalled, ModSource } from '@interfaces';
import { ModsService } from '@services/mods.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-mods',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    ListReflowDirective,
    PanelModsModioComponent,
    SFXDirective,
    SweetAlert2Module,
  ],
  hostDirectives: [FadeInDirective],
  host: { class: 'block' },
  templateUrl: './mods.component.html',
})
export class ModsComponent {
  private router = inject(Router);
  public modsService = inject(ModsService);

  public addToRunSwal = viewChild<SwalComponent>('addToRunSwal');
  public removeSwal = viewChild<SwalComponent>('removeSwal');

  public readonly hasModsFolder = modsDiskAvailable();
  public isBusy = signal(false);

  public missingMods = computed(() => {
    const status = savefileLoadStatus();
    return status.state === 'failed' && status.reason === 'mods'
      ? status.details
      : [];
  });

  public runMods = computed(() =>
    isSetup() && savefileLoadStatus().state === 'ok'
      ? metaState().mods
      : undefined,
  );

  public rows = computed(() => {
    const enabled = getOption('modsEnabled');
    const inRun = new Set((this.runMods() ?? []).map((ref) => ref.id));
    return modsInstalled().map((mod) => {
      const id = mod.manifest?.id ?? mod.key;
      const usable = !!mod.bundle && mod.errors.length === 0;
      return {
        mod,
        id,
        trackKey: `${mod.source}:${mod.key}`,
        usable,
        enabledIndex: enabled.indexOf(id),
        enabledCount: enabled.length,
        inRun: inRun.has(id),
        canAddToRun: usable && this.runMods() !== undefined && !inRun.has(id),
      };
    });
  });

  public modRefLabel = modRefLabel;

  public readonly hasModio = modioIsConfigured();

  public readonly sourceLabels: Record<ModSource, string> = {
    local: 'Imported',
    folder: 'Mods Folder',
    modio: 'mod.io',
  };

  public goHome = (): void => {
    void this.router.navigate(['/']);
  };

  reloadGame(): void {
    window.location.reload();
  }

  async rescan(): Promise<void> {
    await this.modsService.reload();
  }

  openFolder(): void {
    void modsDiskOpenFolder();
  }

  setEnabled(id: string, event: Event): void {
    modsSetEnabled(id, (event.target as HTMLInputElement).checked);
  }

  move(id: string, offset: -1 | 1): void {
    modsMoveEnabled(id, offset);
  }

  async importZip(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    await this.runBusy(async () => {
      const errors = await modsImportZip(file);
      if (errors.length > 0) {
        notifyError(`Could not install that mod. ${errors.join(' ')}`);
        return;
      }
      await this.modsService.reload();
      notifySuccess('Mod installed.');
    });
  }

  async addToRun(mod: ModInstalled): Promise<void> {
    const manifest = mod.manifest;
    const res = await this.addToRunSwal()?.fire();
    if (!res?.isConfirmed || !manifest) return;

    await this.runBusy(async () => {
      const failures = await modsAddToRun(manifest.id);
      if (failures.length > 0) {
        notifyError(`Could not add that mod. ${failures.join(' ')}`);
        return;
      }
      notifySuccess(`${manifest.name} was added to your current run.`);
    });
  }

  async remove(mod: ModInstalled): Promise<void> {
    const res = await this.removeSwal()?.fire();
    if (!res?.isConfirmed) return;

    await this.runBusy(async () => {
      await modsRemoveStored(mod);
      if (mod.modioId !== undefined) await modioUnsubscribe(mod.modioId);
      await this.modsService.reload();
    });
  }

  private async runBusy(work: () => Promise<void>): Promise<void> {
    if (this.isBusy()) return;
    this.isBusy.set(true);
    try {
      await work();
    } finally {
      this.isBusy.set(false);
    }
  }
}
