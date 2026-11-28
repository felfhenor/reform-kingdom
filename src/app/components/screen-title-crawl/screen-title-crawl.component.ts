import { t } from '@helpers/i18n/i18n';
import { TPipe } from '@pipes/t.pipe';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FFButtonComponent } from '@ff/components/button/button.component';
import { FFInputPromptComponent } from '@ff/components/input-prompt/input-prompt.component';
import { FFInputService } from '@ff/input/ff-input.service';
import { ffGamepadOn } from '@ff/input/ff-gamepad-on';
import {
  GAMEPAD_PRIORITY,
  gamepadBlockBehindOverlay,
} from '@helpers/engine/gamepad.ui';
import { modalHasAnyOpen, modalIsOpen } from '@helpers/engine/modal-stack';
import { isGameloopPaused } from '@helpers/gameloop';
import { setOption } from '@helpers/state-options';

const SECONDS_PER_PARAGRAPH = 10;
const SKIP_HOLD_MS = 1000;

@Component({
  selector: 'app-screen-title-crawl',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, FFButtonComponent, FFInputPromptComponent],
  templateUrl: './screen-title-crawl.component.html',
  styleUrl: './screen-title-crawl.component.scss',
  host: {
    '[class.crawl-entering]': 'fadeIn()',
  },
})
export class ScreenTitleCrawlComponent {
  public paragraphs = input.required<string[]>();
  public fadeIn = input(false);
  public finished = output<boolean>();

  public crawlSeconds = computed(
    () => this.paragraphs().length * SECONDS_PER_PARAGRAPH,
  );

  // An open modal holds it too, so it can't play out unseen beneath one.
  public isPaused = computed(() => isGameloopPaused() || modalHasAnyOpen());
  public isFadingOut = signal(false);
  public skipProgress = signal(0);
  private readonly ffInput = inject(FFInputService);
  protected isGamepadMode = computed(() => this.ffInput.mode() === 'gamepad');

  private holdStartedAt?: number;
  private holdFrame?: number;
  private wasSkipped = false;

  constructor() {
    // The pause option survives reloads, but the pause menu doesn't - a leftover pause would freeze the crawl before any text shows.
    if (isGameloopPaused() && !modalIsOpen('pause-menu')) {
      setOption('gameloopPaused', false);
    }

    // Capture phase so navbar hotkeys can't act under the crawl; only Esc (pause menu), Space-to-resume and open modals get through.
    const onKeydown = (event: KeyboardEvent) => {
      const isSpace = event.key === ' ';
      if (event.key === 'Escape' || modalHasAnyOpen()) return;
      if (isSpace && isGameloopPaused()) return;
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
    gamepadBlockBehindOverlay();
    ffGamepadOn('confirm', () => this.startSkipHold(), {
      priority: GAMEPAD_PRIORITY.overlay,
      enabled: () => !modalHasAnyOpen(),
      label: t('screenTitleCrawl.holdToSkip2'),
      onRelease: () => this.cancelSkipHold(),
    });
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

    this.finished.emit(this.wasSkipped);
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
