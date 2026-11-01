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
import {
  LOADING_FULL_HOLD_MS,
  LOADING_IDLE_TIMEOUT_MS,
  LOADING_STALL_WARN_MS,
} from '@helpers/config';
import { loadingProgressCalculate } from '@helpers/engine/loading.ui';
import { hasGameStateLoaded } from '@helpers/state-game';
import type { LoadingStep } from '@interfaces';
import { ContentService } from '@services/content.service';
import { GamestateService } from '@services/gamestate.service';
import { LoggerService } from '@services/logger.service';
import { SoundService } from '@services/sound.service';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private contentService = inject(ContentService);
  private gamestateService = inject(GamestateService);
  private soundService = inject(SoundService);
  private injector = inject(Injector);
  private logger = inject(LoggerService);

  private hasHeldFull = signal(false);
  private idleHandle?: number;
  private holdTimer?: ReturnType<typeof setTimeout>;
  private stallTimer?: ReturnType<typeof setTimeout>;
  private loggedSteps = new Set<string>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.idleHandle !== undefined) cancelIdleCallback(this.idleHandle);
      clearTimeout(this.holdTimer);
      clearTimeout(this.stallTimer);
    });

    effect(() => this.logFinishedSteps(this.steps()));
    this.stallTimer = setTimeout(() => this.logStall(), LOADING_STALL_WARN_MS);

    // Counted from after the routed page's first render, then idle, so the hold isn't eaten by that page's stall.
    effect(() => {
      if (!this.progress().isComplete) return;
      afterNextRender(() => this.holdWhenIdle(), { injector: this.injector });
    });
  }

  private logFinishedSteps(steps: LoadingStep[]): void {
    steps
      .filter((step) => step.isDone && !this.loggedSteps.has(step.label))
      .forEach((step) => {
        this.loggedSteps.add(step.label);
        this.logger.info(
          'Loading',
          `Done: ${step.label} (+${Math.round(performance.now())}ms since page load)`,
        );
      });
  }

  private logStall(): void {
    const pending = this.steps().filter((step) => !step.isDone);
    if (pending.length === 0) return;
    this.logger.warn(
      'Loading',
      `Still loading after ${LOADING_STALL_WARN_MS}ms, waiting on: ${pending.map((step) => step.label).join(', ')}`,
    );
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

  private steps = computed<LoadingStep[]>(() => [
    {
      label: 'Loading game data...',
      isDone: this.contentService.hasLoadedData(),
    },
    {
      label: 'Loading game art...',
      isDone: this.contentService.hasLoadedArt(),
    },
    {
      label: 'Loading UI art...',
      isDone: this.contentService.hasLoadedUIArt(),
    },
    {
      label: 'Loading UI fonts...',
      isDone: this.contentService.hasLoadedFonts(),
    },
    {
      label: 'Loading UI scripts...',
      isDone: this.contentService.hasLoadedUILibraries(),
    },
    {
      label: 'Loading map data...',
      isDone: this.contentService.hasLoadedMaps(),
    },
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
  ]);

  public progress = computed(() => loadingProgressCalculate(this.steps()));

  public isReady = computed(
    () => this.progress().isComplete && this.hasHeldFull(),
  );
}
