import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  LOADING_FILL_FALLBACK_MS,
  LOADING_FULL_HOLD_MS,
} from '@helpers/config';
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

  private hasHeldFull = signal(false);
  private holdTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.holdTimer));

    // Hidden tabs never run the bar's tween, so it can't be relied on to report as filled.
    effect(() => {
      if (this.progress().isComplete) this.startHold(LOADING_FILL_FALLBACK_MS);
    });
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
      { label: 'Loading maps...', isDone: this.contentService.hasLoadedMaps() },
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

  // Called by the loading screen once its bar visually reaches the end.
  public onBarFilled(): void {
    if (this.progress().isComplete) this.startHold(LOADING_FULL_HOLD_MS);
  }

  private startHold(ms: number): void {
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => this.hasHeldFull.set(true), ms);
  }
}
