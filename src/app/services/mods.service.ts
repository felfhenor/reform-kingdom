import { Injectable, signal } from '@angular/core';
import { isDemoBuild } from '@helpers/demo/demo';
import { error } from '@helpers/engine/logging';
import { notifyError } from '@helpers/engine/notify';
import { modsPruneEnabled, modsRefreshRun } from '@helpers/mod/mod-install.ui';
import { modsLoadAll, modsRevokeUnused } from '@helpers/mod/mod-load.ui';
import { modsInstalled, setModsInstalled } from '@helpers/mod/mod-registry';

@Injectable({
  providedIn: 'root',
})
export class ModsService {
  public hasLoaded = signal<boolean>(false);
  public isLoading = signal<boolean>(false);

  // Always settles, so a broken mod can never hold the loading screen.
  async init(): Promise<void> {
    if (!isDemoBuild()) await this.reload();
    this.hasLoaded.set(true);
  }

  async reload(): Promise<void> {
    this.isLoading.set(true);
    try {
      const previous = modsInstalled();
      setModsInstalled(await modsLoadAll());
      modsRevokeUnused(previous);
      modsPruneEnabled(
        modsInstalled().flatMap((mod) =>
          mod.manifest ? [mod.manifest.id] : [],
        ),
      );

      const failures = await modsRefreshRun();
      if (failures.length > 0) {
        notifyError(`Could not update your run's mods. ${failures.join(' ')}`);
      }
    } catch (e) {
      error('Mods', 'Could not load installed mods.', e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
