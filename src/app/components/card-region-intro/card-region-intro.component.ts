import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { modalHasAnyOpen } from '@helpers/engine/modal-stack';
import { regionIntroPending } from '@helpers/lore/region-intro';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';
import { regionIntroMarkSeen } from '@helpers/lore/region-intro.ui';

const REVEAL_MS_PER_CHARACTER = 30;
const LINGER_AFTER_REVEAL_MS = 4000;
const LEAVE_ANIMATION_MS = 400;

@Component({
  selector: 'app-card-region-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-region-intro.component.html',
  styleUrl: './card-region-intro.component.scss',
})
export class CardRegionIntroComponent {
  public mapName = input.required<string>();

  private isPageShown = signal(!document.hidden);
  private revealedCharacters = signal(0);
  public isLeaving = signal(false);
  private leaveTimer?: ReturnType<typeof setTimeout>;

  // Held back (and restarted later) while nobody can read it, so it's never marked seen unread.
  public region = computed(() =>
    this.isPageShown() && !modalHasAnyOpen() && !isTitleCrawlPending()
      ? regionIntroPending(this.mapName())
      : undefined,
  );

  public revealedText = computed(
    () => this.region()?.description.slice(0, this.revealedCharacters()) ?? '',
  );

  public hiddenText = computed(
    () => this.region()?.description.slice(this.revealedCharacters()) ?? '',
  );

  constructor() {
    effect((onCleanup) => {
      const region = this.region();
      if (!region) return;

      untracked(() => {
        this.revealedCharacters.set(0);
        this.isLeaving.set(false);
      });

      const length = region.description.length;
      const revealTimer = setInterval(() => {
        this.revealedCharacters.update((count) => Math.min(count + 1, length));
      }, REVEAL_MS_PER_CHARACTER);
      const dismissTimer = setTimeout(
        () => this.dismiss(),
        length * REVEAL_MS_PER_CHARACTER + LINGER_AFTER_REVEAL_MS,
      );

      onCleanup(() => {
        clearInterval(revealTimer);
        clearTimeout(dismissTimer);
        clearTimeout(this.leaveTimer);
      });
    });

    // Capture phase so Escape dismisses the intro instead of also opening the pause menu.
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.region() || this.isLeaving()) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      this.dismiss();
    };
    const onVisibilityChange = () => this.isPageShown.set(!document.hidden);

    window.addEventListener('keydown', onKeydown, { capture: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('keydown', onKeydown, { capture: true });
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(this.leaveTimer);
    });
  }

  private dismiss(): void {
    if (this.isLeaving()) return;

    const mapName = this.mapName();
    this.isLeaving.set(true);
    this.leaveTimer = setTimeout(
      () => void regionIntroMarkSeen(mapName),
      LEAVE_ANIMATION_MS,
    );
  }
}
