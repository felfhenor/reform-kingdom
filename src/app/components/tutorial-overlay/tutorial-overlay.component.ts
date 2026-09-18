import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { Event } from '@angular/router';
import { NavigationEnd, Router } from '@angular/router';
import { SFXDirective } from '@directives/sfx.directive';
import { gameloopShouldRun } from '@helpers/gameloop';
import {
  activeTutorialStepView,
  tutorialAdvance,
  tutorialCheckAutoTrigger,
  tutorialSkip,
  tutorialTargetRect,
} from '@helpers/tutorial/tutorial-engine.ui';
import type { TutorialId } from '@interfaces';
import { LoadingService } from '@services/loading.service';
import { clamp } from 'es-toolkit/compat';

function stepKey(tutorialId: TutorialId, stepIndex: number): string {
  return `${tutorialId}:${stepIndex}`;
}

const CALLOUT_WIDTH = 320;
const CALLOUT_HEIGHT_ESTIMATE = 160;
const CALLOUT_GAP = 12;
// Every step (not just the first) waits this long before rendering - a target's position can be measured before its page/layout has fully settled, and nothing else re-measures it later.
const STEP_SETTLE_DELAY_MS = 250;

@Component({
  selector: 'app-tutorial-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  host: {
    '(window:resize)': 'bumpResizeTick()',
    '(window:scroll)': 'bumpResizeTick()',
  },
  templateUrl: './tutorial-overlay.component.html',
  styleUrl: './tutorial-overlay.component.scss',
})
export class TutorialOverlayComponent {
  private router = inject(Router);
  private loadingService = inject(LoadingService);

  private resizeTick = signal(0);

  // Router-driven so this reacts precisely on navigation, including into `/game` - never true on the title screen.
  private isInGameRoute = signal(gameloopShouldRun());

  // Same "loading screen done" signal app.component.html uses - without it, a fresh load can flicker the overlay in while content is still loading.
  private isGameReady = computed(
    () => this.isInGameRoute() && this.loadingService.isReady(),
  );

  private rawStepView = computed(() =>
    this.isGameReady() ? activeTutorialStepView() : undefined,
  );

  // Only the step that's been active for STEP_SETTLE_DELAY_MS is shown
  private settledStepKey = signal<string | undefined>(undefined);

  public stepView = computed(() => {
    const raw = this.rawStepView();
    if (!raw) return undefined;
    return stepKey(raw.tutorial.id, raw.stepIndex) === this.settledStepKey()
      ? raw
      : undefined;
  });

  public targetRect = computed(() => {
    this.resizeTick();
    const view = this.stepView();
    if (!view) return undefined;
    return tutorialTargetRect(view.step.targetKey);
  });

  // Waits indefinitely (no timeout fallback) rather than showing a dimmed screen with no highlight before the target resolves - every target key is authored in this codebase, so it will always resolve.
  public isReadyToRender = computed(
    () => !!this.stepView() && !!this.targetRect(),
  );

  public calloutPosition = computed(() => {
    const rect = this.targetRect();
    if (!rect) {
      return {
        top: window.innerHeight / 2 - CALLOUT_HEIGHT_ESTIMATE / 2,
        left: window.innerWidth / 2 - CALLOUT_WIDTH / 2,
      };
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow > CALLOUT_HEIGHT_ESTIMATE + CALLOUT_GAP
        ? rect.bottom + CALLOUT_GAP
        : Math.max(
            rect.top - CALLOUT_HEIGHT_ESTIMATE - CALLOUT_GAP,
            CALLOUT_GAP,
          );
    const left = clamp(
      rect.left,
      CALLOUT_GAP,
      window.innerWidth - CALLOUT_WIDTH - CALLOUT_GAP,
    );

    return { top, left };
  });

  constructor() {
    this.router.events.subscribe((event: Event) => {
      if (!(event instanceof NavigationEnd)) return;
      this.isInGameRoute.set(event.url.includes('/game'));
    });

    effect(() => {
      if (!this.isGameReady()) return;
      tutorialCheckAutoTrigger();
    });

    // Restarts the settle timer whenever the raw (unsettled) step changes - new tutorial, new step, or a different one picked via the corner icon.
    effect((onCleanup) => {
      const raw = this.rawStepView();
      if (!raw) {
        this.settledStepKey.set(undefined);
        return;
      }

      const key = stepKey(raw.tutorial.id, raw.stepIndex);
      const timeoutId = setTimeout(
        () => this.settledStepKey.set(key),
        STEP_SETTLE_DELAY_MS,
      );
      onCleanup(() => clearTimeout(timeoutId));
    });
  }

  public bumpResizeTick(): void {
    this.resizeTick.update((v) => v + 1);
  }

  public next(): void {
    void tutorialAdvance();
  }

  public skip(): void {
    void tutorialSkip();
  }
}
