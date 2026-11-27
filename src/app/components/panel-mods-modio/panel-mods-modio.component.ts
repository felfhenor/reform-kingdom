import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { notifyError, notifySuccess } from '@helpers/engine/notify';
import { modsInstalled } from '@helpers/mod/mod-registry';
import {
  MODIO_PAGE_SIZE,
  modioExchangeCode,
  modioInstall,
  modioIsSignedIn,
  modioRequestCode,
  modioSearchMods,
  modioSignOut,
  modioSubscribedMods,
} from '@helpers/mod/modio.ui';
import type { ModioMod, ModioSort } from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { ModsService } from '@services/mods.service';

@Component({
  selector: 'app-panel-mods-modio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    DecimalPipe,
    FormsModule,
    IconComponent,
    NgSelectComponent,
    SFXDirective,
  ],
  templateUrl: './panel-mods-modio.component.html',
})
export class PanelModsModioComponent {
  private modsService = inject(ModsService);

  public readonly sortOptions: { label: string; value: ModioSort }[] = [
    { label: 'Name', value: 'name' },
    { label: 'Popular', value: '-popular' },
    { label: 'Downloads', value: '-downloads_total' },
    { label: 'Recently Updated', value: '-date_updated' },
  ];

  public email = signal('');
  public code = signal('');
  public codeSent = signal(false);
  public isSignedIn = computed(() => modioIsSignedIn());

  public query = signal('');
  public sort = signal<ModioSort>('-popular');
  public offset = signal(0);
  public total = signal(0);
  public results = signal<ModioMod[]>([]);
  public hasSearched = signal(false);
  public busyId = signal<number | undefined>(undefined);

  public pageLabel = computed(() => {
    const page = Math.floor(this.offset() / MODIO_PAGE_SIZE) + 1;
    const pages = Math.max(1, Math.ceil(this.total() / MODIO_PAGE_SIZE));
    return { page, pages };
  });

  public installedVersions = computed(
    () =>
      new Map(
        modsInstalled()
          .filter((mod) => mod.modioId !== undefined)
          .map((mod) => [mod.modioId, mod.manifest?.version]),
      ),
  );

  async sendCode(): Promise<void> {
    await this.attempt(async () => {
      await modioRequestCode(this.email());
      this.codeSent.set(true);
      notifySuccess('Check your email for a mod.io code.');
    });
  }

  async signIn(): Promise<void> {
    await this.attempt(async () => {
      await modioExchangeCode(this.code().trim());
      this.code.set('');
      this.codeSent.set(false);
    });
  }

  signOut(): void {
    modioSignOut();
  }

  async search(offset = 0): Promise<void> {
    await this.attempt(async () => {
      const page = await modioSearchMods({
        query: this.query().trim(),
        sort: this.sort(),
        offset,
      });
      this.offset.set(offset);
      this.total.set(page.result_total);
      this.results.set(page.data);
      this.hasSearched.set(true);
    });
  }

  page(direction: -1 | 1): void {
    void this.search(this.offset() + direction * MODIO_PAGE_SIZE);
  }

  async install(mod: ModioMod): Promise<void> {
    this.busyId.set(mod.id);
    await this.attempt(async () => {
      const errors = await modioInstall(mod);
      if (errors.length > 0) {
        notifyError(`Could not install ${mod.name}. ${errors.join(' ')}`);
        return;
      }
      await this.modsService.reload();
      notifySuccess(`${mod.name} installed.`);
    });
    this.busyId.set(undefined);
  }

  async installSubscribed(): Promise<void> {
    await this.attempt(async () => {
      const missing = (await modioSubscribedMods()).filter(
        (mod) => !this.installedVersions().has(mod.id),
      );
      for (const mod of missing) await this.install(mod);
      if (missing.length === 0)
        notifySuccess('All subscribed mods are installed.');
    });
  }

  private async attempt(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (e) {
      notifyError(`mod.io: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
