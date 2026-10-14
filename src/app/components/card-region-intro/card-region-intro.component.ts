import {
  type AnimationCallbackEvent,
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
import { gamePlayView } from '@helpers/engine/ui';
import { regionIntroPending } from '@helpers/lore/region-intro';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';
import { regionIntroMarkSeen } from '@helpers/lore/region-intro.ui';
import { AnimationService } from '@services/animation.service';

const REVEAL_MS_PER_CHARACTER = 30;
const LINGER_AFTER_REVEAL_MS = 4000;

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
  private anim = inject(AnimationService);
  private isDismissing = false;

  // Held back (and restarted later) while nobody can read it, so it's never marked seen unread.
  public region = computed(() =>
    this.isPageShown() &&
    gamePlayView() === 'world' &&
    !modalHasAnyOpen() &&
    !isTitleCrawlPending()
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

      untracked(() => this.revealedCharacters.set(0));
      this.isDismissing = false;

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
      });
    });

    // Capture phase so Escape dismisses the intro instead of also opening the pause menu.
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.region() || this.isDismissing) return;

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
    });
  }

  // Only a real dismissal shatters; a modal, hidden tab or other game view hides it instantly so a returning card isn't stacked under the old one.
  public onLeave(event: AnimationCallbackEvent): void {
    if (!this.isDismissing) {
      event.animationComplete();
      return;
    }

    this.anim
      .shatterIntoSmoke(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }

  private dismiss(): void {
    if (this.isDismissing) return;

    this.isDismissing = true;
    void regionIntroMarkSeen(this.mapName());
  }
}
