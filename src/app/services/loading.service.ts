import {
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
} from '@angular/core';
import { LOADING_FULL_HOLD_MS, LOADING_IDLE_TIMEOUT_MS } from '@helpers/config';
import { loadingProgressCalculate } from '@helpers/engine/loading.ui';
import { hasGameStateLoaded } from '@helpers/state-game';
import { ContentService } from '@services/content.service';
import { GamestateService } from '@services/gamestate.service';
import { SoundService } from '@services/sound.service';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private contentService = inject(ContentService);
  private gamestateService = inject(GamestateService);
  private soundService = inject(SoundService);
  private injector = inject(Injector);

  private hasHeldFull = signal(false);
  private idleHandle?: number;
  private holdTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.idleHandle !== undefined) cancelIdleCallback(this.idleHandle);
      clearTimeout(this.holdTimer);
    });

    // Counted from after the routed page's first render, then idle, so the hold isn't eaten by that page's stall.
    effect(() => {
      if (!this.progress().isComplete) return;
      afterNextRender(() => this.holdWhenIdle(), { injector: this.injector });
    });
  }

  private holdWhenIdle(): void {
    // Safari lacks requestIdleCallback.
    if (typeof requestIdleCallback === 'undefined') return this.startHold();

    this.idleHandle = requestIdleCallback(() => this.startHold(), {
      timeout: LOADING_IDLE_TIMEOUT_MS,
    });
  }

  private startHold(): void {
    this.holdTimer = setTimeout(
      () => this.hasHeldFull.set(true),
      LOADING_FULL_HOLD_MS,
    );
  }

  public progress = computed(() =>
    loadingProgressCalculate([
      {
        label: 'Loading game data...',
        isDone: this.contentService.hasLoadedData(),
      },
      {
        label: 'Loading artwork...',
        isDone: this.contentService.hasLoadedArt(),
      },
      {
        label: 'Loading UI art...',
        isDone: this.contentService.hasLoadedUIArt(),
      },
      { label: 'Loading maps...', isDone: this.contentService.hasLoadedMaps() },
      {
        label: 'Loading map art...',
        isDone: this.contentService.hasLoadedMapArt(),
      },
      { label: 'Loading music...', isDone: this.soundService.hasLoadedAudio() },
      { label: 'Loading your save...', isDone: hasGameStateLoaded() },
      {
        label: 'Preparing your kingdom...',
        isDone: this.gamestateService.hasLoaded(),
      },
    ]),
  );

  public isReady = computed(
    () => this.progress().isComplete && this.hasHeldFull(),
  );
}
