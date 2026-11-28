import { inject, Injectable, signal } from '@angular/core';
import { isDemoBuild } from '@helpers/demo/demo';
import { error } from '@helpers/engine/logging';
import { notifyError } from '@helpers/engine/notify';
import { t } from '@helpers/i18n/i18n';
import { modsPruneEnabled, modsRefreshRun } from '@helpers/mod/mod-install.ui';
import { modLanguageApply } from '@helpers/mod/mod-language.ui';
import { modsLoadAll, modsRevokeUnused } from '@helpers/mod/mod-load.ui';
import { modsInstalled, setModsInstalled } from '@helpers/mod/mod-registry';
import { ContentService } from '@services/content.service';

@Injectable({
  providedIn: 'root',
})
export class ModsService {
  private contentService = inject(ContentService);

  public hasLoaded = signal<boolean>(false);
  public isLoading = signal<boolean>(false);

  // Always settles, so a broken mod can never hold the loading screen.
  async init(): Promise<void> {
    if (!isDemoBuild()) await this.reload();

    // A mod language layers on top of the base text, so that has to be in first.
    await this.contentService.waitForI18n();
    const languageError = modLanguageApply();
    if (languageError !== undefined) {
      notifyError(t('options.language.missingMod', { reason: languageError }));
    }

    this.hasLoaded.set(true);
  }

  // `reapply` pushes unchanged versions into the run too, so modders see edits without a version bump.
  async reload(reapply = false): Promise<void> {
    this.isLoading.set(true);
    try {
      const previous = modsInstalled();
      setModsInstalled(await modsLoadAll());
      modsPruneEnabled(
        modsInstalled().flatMap((mod) =>
          mod.manifest && mod.manifest.kind !== 'i18n' ? [mod.manifest.id] : [],
        ),
      );

      const failures = await modsRefreshRun(reapply);
      if (failures.length > 0) {
        notifyError(`Could not update your run's mods. ${failures.join(' ')}`);
      }
      modsRevokeUnused(previous);
    } catch (e) {
      error('Mods', 'Could not load installed mods.', e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
