import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';
import { modalIsOpen } from '@helpers/engine/modal-stack';
import { isGameloopPaused } from '@helpers/gameloop';
import {
  TITLE_CRAWL_PARAGRAPHS,
  titleCrawlFinish,
} from '@helpers/lore/title-crawl.ui';
import { setOption } from '@helpers/state-options';

const SECONDS_PER_PARAGRAPH = 7;
const SKIP_HOLD_MS = 1000;

@Component({
  selector: 'app-screen-title-crawl',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  templateUrl: './screen-title-crawl.component.html',
  styleUrl: './screen-title-crawl.component.scss',
})
export class ScreenTitleCrawlComponent {
  public paragraphs = TITLE_CRAWL_PARAGRAPHS;
  public crawlSeconds = TITLE_CRAWL_PARAGRAPHS.length * SECONDS_PER_PARAGRAPH;

  public isPaused = isGameloopPaused;
  public isFadingOut = signal(false);
  public skipProgress = signal(0);

  private holdStartedAt?: number;
  private holdFrame?: number;
  private wasSkipped = false;

  constructor() {
    // The pause option survives reloads, but the pause menu doesn't - a leftover pause would freeze the crawl before any text shows.
    if (this.isPaused() && !modalIsOpen('pause-menu')) {
      setOption('gameloopPaused', false);
    }

    // Capture phase so navbar hotkeys can't act under the crawl; only Esc (pause menu) and Space-to-resume get through.
    const onKeydown = (event: KeyboardEvent) => {
      const isSpace = event.key === ' ';
      if (event.key === 'Escape' || (isSpace && this.isPaused())) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isSpace && !event.repeat) this.startSkipHold();
    };
    const onKeyup = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      this.cancelSkipHold();
    };

    window.addEventListener('keydown', onKeydown, { capture: true });
    window.addEventListener('keyup', onKeyup, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('keydown', onKeydown, { capture: true });
      window.removeEventListener('keyup', onKeyup, { capture: true });
      this.cancelSkipHold();
    });
  }

  public startSkipHold(): void {
    if (this.holdStartedAt !== undefined || this.isFadingOut()) return;

    this.holdStartedAt = performance.now();
    this.holdFrame = requestAnimationFrame(() => this.tickSkipHold());
  }

  public cancelSkipHold(): void {
    if (this.holdFrame !== undefined) cancelAnimationFrame(this.holdFrame);
    this.holdFrame = undefined;
    this.holdStartedAt = undefined;
    this.skipProgress.set(0);
  }

  public onScrollEnd(): void {
    this.isFadingOut.set(true);
  }

  public onFadeEnd(event: AnimationEvent): void {
    if (event.target !== event.currentTarget) return;

    void titleCrawlFinish(this.wasSkipped);
  }

  private skip(): void {
    this.wasSkipped = true;
    this.cancelSkipHold();
    this.isFadingOut.set(true);
  }

  private tickSkipHold(): void {
    if (this.holdStartedAt === undefined) return;

    const progress = (performance.now() - this.holdStartedAt) / SKIP_HOLD_MS;
    this.skipProgress.set(Math.min(progress, 1));
    if (progress >= 1) {
      this.skip();
      return;
    }

    this.holdFrame = requestAnimationFrame(() => this.tickSkipHold());
  }
}
