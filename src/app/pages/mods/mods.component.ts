import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop';
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
import { IconModLogoComponent } from '@components/icon-mod-logo/icon-mod-logo.component';
import { IconComponent } from '@components/icon/icon.component';
import { PanelModsModioComponent } from '@components/panel-mods-modio/panel-mods-modio.component';
import { FadeInDirective } from '@directives/fade-in.directive';
import { ListReflowDragDirective } from '@directives/list-reflow-drag.directive';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { FFInputPromptComponent } from '@ff/components/input-prompt/input-prompt.component';
import { FFPadActionDirective } from '@ff/controls/ff-pad-action.directive';
import { FFReorderItemDirective } from '@ff/controls/ff-reorder-item.directive';
import { FFReorderListDirective } from '@ff/controls/ff-reorder-list.directive';
import { FFFocusRowDirective } from '@ff/focus/ff-focus-row.directive';
import { FFTriggerTabsDirective } from '@ff/focus/ff-trigger-tabs.directive';
import { GAMEPAD_PRIORITY } from '@helpers/engine/gamepad.ui';
import { notifyError, notifySuccess } from '@helpers/engine/notify';
import { uiScaleCurrent } from '@helpers/engine/ui-scale.ui';
import {
  modsDiskAvailable,
  modsDiskOpenFolder,
} from '@helpers/mod/mod-disk.ui';
import {
  modsAddToRun,
  modsImportZip,
  modsRemoveStored,
  modsReorderEnabled,
  modsSetEnabled,
} from '@helpers/mod/mod-install.ui';
import {
  modGameVersionMismatch,
  modsInstalled,
} from '@helpers/mod/mod-registry';
import { isDemoBuild } from '@helpers/demo/demo';
import { localVersion } from '@helpers/engine/version';
import { languageChoice } from '@helpers/i18n/i18n-language';
import { languageChoose, languageReload } from '@helpers/mod/mod-language.ui';
import { modioIsConfigured, modioUnsubscribe } from '@helpers/mod/modio.ui';
import { savefileLoadStatus } from '@helpers/savefile/savefile-load';
import { isSetup } from '@helpers/setup';
import { metaState } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import type { ModInstalled, ModSource, ModsTab } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { TPipe } from '@pipes/t.pipe';
import { ModsService } from '@services/mods.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-mods',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    FFButtonComponent,
    FFFocusRowDirective,
    FFPadActionDirective,
    FFTriggerTabsDirective,
    FFReorderItemDirective,
    FFReorderListDirective,
    FFInputPromptComponent,
    IconComponent,
    ListReflowDragDirective,
    DragDropModule,
    IconModLogoComponent,
    ListReflowDirective,
    PanelModsModioComponent,
    SweetAlert2Module,
    TippyDirective,
    TPipe,
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
  public readonly reorderPriority = GAMEPAD_PRIORITY.popover;
  public uiScale = uiScaleCurrent;

  public activeTab = signal<ModsTab>('installed');
  public readonly tabs: { id: ModsTab; name: string }[] = [
    { id: 'installed', name: 'Installed' },
    { id: 'modio', name: 'mod.io' },
  ];

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
    const language = languageChoice();
    const inRun = new Set((this.runMods() ?? []).map((ref) => ref.id));
    const rows = modsInstalled().map((mod) => {
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
        isLanguage: mod.manifest?.kind === 'i18n',
        isLanguageInUse: language.source === 'mod' && language.modId === id,
        isOtherVersion: modGameVersionMismatch(
          mod.manifest?.gameVersion,
          localVersion()?.tag,
        ),
        canAddToRun:
          usable &&
          mod.manifest?.kind !== 'i18n' &&
          this.runMods() !== undefined &&
          !inRun.has(id),
      };
    });
    return sortBy(rows, [
      (row) => (row.enabledIndex >= 0 ? row.enabledIndex : Infinity),
      (row) => (row.inRun ? 0 : 1),
    ]);
  });

  public readonly hasModio = modioIsConfigured();
  public readonly isDemo = isDemoBuild();

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
    await this.modsService.reload(true);
  }

  openFolder(): void {
    void modsDiskOpenFolder();
  }

  setEnabled(id: string, event: Event): void {
    modsSetEnabled(id, (event.target as HTMLInputElement).checked);
  }

  // Only New Games mods are ordered, and they lead the list, so list indices are load-order indices.
  public canDropAt = (index: number): boolean =>
    index < getOption('modsEnabled').length;

  onDrop(event: CdkDragDrop<unknown>): void {
    this.reorder(event.previousIndex, event.currentIndex);
  }

  reorder(fromIndex: number, toIndex: number): void {
    modsReorderEnabled(fromIndex, toIndex);
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

  async useLanguage(mod: ModInstalled): Promise<void> {
    const manifest = mod.manifest;
    const translations = mod.bundle?.translations;
    if (!manifest || !translations) return;

    await this.runBusy(() =>
      languageChoose({
        source: 'mod',
        modId: manifest.id,
        locale: translations.locale,
      }),
    );
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

    const language = languageChoice();
    const isLanguageInUse =
      language.source === 'mod' && language.modId === mod.manifest?.id;

    await this.runBusy(async () => {
      await modsRemoveStored(mod);
      if (mod.modioId !== undefined) await modioUnsubscribe(mod.modioId);
      await this.modsService.reload();
      // Text is read once at load, so dropping the active language needs a reload to show English.
      if (isLanguageInUse) await languageReload();
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
