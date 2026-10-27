import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@components/icon/icon.component';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { isInElectron } from '@helpers/engine/electron';
import {
  electronWindowOnChange,
  electronWindowSetFullscreen,
  electronWindowSetSize,
  electronWindowState,
  windowSizeChoices,
  windowSizeCurrentId,
} from '@helpers/engine/electron-window.ui';
import { defaultOptions } from '@helpers/state-options';
import type {
  AdventureLogEntryKind,
  ElectronWindowState,
  WindowDisplayMode,
} from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';

type FrameRateChoice = { label: string; value: number };
type DisplayModeChoice = { label: string; value: WindowDisplayMode };

@Component({
  selector: 'app-panel-options-ui',
  imports: [
    DecimalPipe,
    FormsModule,
    IconComponent,
    NgSelectComponent,
    TippyDirective,
  ],
  templateUrl: './panel-options-ui.component.html',
  styleUrl: './panel-options-ui.component.scss',
})
export class PanelOptionsUIComponent extends OptionsBaseComponent {
  public readonly mapFrameRateChoices: FrameRateChoice[] = [
    { label: '15 FPS', value: 15 },
    { label: '30 FPS', value: 30 },
    { label: '60 FPS', value: 60 },
  ];

  public mapFrameRate = signal<number>(this.getOption('mapFrameRate'));

  public readonly isElectron = isInElectron();

  public readonly displayModeChoices: DisplayModeChoice[] = [
    { label: 'Windowed', value: 'windowed' },
    { label: 'Fullscreen', value: 'fullscreen' },
  ];

  public windowState = signal<ElectronWindowState | undefined>(undefined);

  // Linked to the real window state so a rejected pick snaps back instead of lingering in the select.
  public displayMode = linkedSignal<
    ElectronWindowState | undefined,
    WindowDisplayMode
  >({
    source: this.windowState,
    computation: (state) => (state?.fullscreen ? 'fullscreen' : 'windowed'),
  });

  public windowSizeId = linkedSignal<
    ElectronWindowState | undefined,
    string | undefined
  >({
    source: this.windowState,
    computation: (state) => (state ? windowSizeCurrentId(state) : undefined),
  });

  public windowSizeChoices = computed(() => {
    const state = this.windowState();
    return state ? windowSizeChoices(state) : [];
  });

  constructor() {
    super();
    if (!this.isElectron) return;

    const unsubscribe = electronWindowOnChange((state) =>
      this.windowState.set(state),
    );
    inject(DestroyRef).onDestroy(() => unsubscribe?.());
    void this.refreshWindowState();
  }

  public async setDisplayMode(mode: WindowDisplayMode): Promise<void> {
    this.windowState.set(
      await electronWindowSetFullscreen(mode === 'fullscreen'),
    );
  }

  public async setWindowSize(id: string): Promise<void> {
    const choice = this.windowSizeChoices().find((c) => c.id === id);
    if (!choice) return;

    this.windowState.set(await electronWindowSetSize(choice));
  }

  private async refreshWindowState(): Promise<void> {
    this.windowState.set(await electronWindowState());
  }

  // From the defaults, not the saved option, so kinds no longer in the game don't linger in the list.
  public readonly adventureLogKinds = Object.keys(
    defaultOptions().adventureLogOverlayKinds,
  ) as AdventureLogEntryKind[];

  public toggleAdventureLogOverlayKind(kind: AdventureLogEntryKind): void {
    const kinds = this.getOption('adventureLogOverlayKinds');
    this.setOption('adventureLogOverlayKinds', {
      ...kinds,
      [kind]: !kinds[kind],
    });
  }
}
