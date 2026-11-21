import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { formatDuration } from '@helpers/engine/timer';
import { formatDurationDelta } from '@helpers/engine/timer.ui';
import { isGameloopPaused } from '@helpers/gameloop';
import { legacyBestTimedRun } from '@helpers/legacy/legacy.ui';
import { runSplits } from '@helpers/run-stats/run-stats.ui';
import {
  clockState,
  globalEffectSumsState,
  runStatsState,
} from '@helpers/state-game';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-status-run-timer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TippyDirective],
  host: { class: 'contents' },
  templateUrl: './status-run-timer.component.html',
  styleUrl: './status-run-timer.component.scss',
})
export class StatusRunTimerComponent {
  private anim = inject(AnimationService);

  public isShown = computed(() => globalEffectSumsState().showRunTimer);
  public isPaused = isGameloopPaused;
  public time = computed(() => formatDuration(clockState().numTicks));

  private bestRun = computed(() => legacyBestTimedRun());
  public bestTime = computed(() => {
    const best = this.bestRun();
    return best ? formatDuration(best.ticks) : undefined;
  });

  public splits = computed(() => {
    const bestTicks = new Map(
      runSplits(this.bestRun()?.stats.run).map((split) => [
        split.key,
        split.tick,
      ]),
    );

    return runSplits(runStatsState()).map((split) => {
      const bestTick = bestTicks.get(split.key);
      const diff = bestTick === undefined ? undefined : split.tick - bestTick;
      return {
        ...split,
        time: formatDuration(split.tick),
        delta: diff === undefined ? undefined : formatDurationDelta(diff),
        isAhead: diff !== undefined && diff <= 0,
      };
    });
  });

  public onEnter(event: AnimationCallbackEvent): void {
    this.anim.popIn(event.target);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}
