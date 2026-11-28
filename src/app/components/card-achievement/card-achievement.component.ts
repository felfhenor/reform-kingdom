import { TPipe } from '@pipes/t.pipe';
import {
  type AnimationCallbackEvent,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { achievementCardIsHeld } from '@helpers/achievement/achievement-announce.ui';
import type { AchievementCard } from '@interfaces';
import { AchievementService } from '@services/achievement.service';
import { AnimationService } from '@services/animation.service';
import { LoadingService } from '@services/loading.service';

const CARD_POLL_MS = 500;
const CARD_LINGER_MS = 5000;

@Component({
  selector: 'app-card-achievement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, AtlasImageComponent, DecimalPipe],
  templateUrl: './card-achievement.component.html',
  styleUrl: './card-achievement.component.scss',
})
export class CardAchievementComponent {
  private achievements = inject(AchievementService);
  private anim = inject(AnimationService);
  private loading = inject(LoadingService);

  private cardElement = viewChild<ElementRef<HTMLElement>>('card');
  private shineElement = viewChild<ElementRef<HTMLElement>>('shine');

  public card = signal<AchievementCard | undefined>(undefined);
  private isLeaving = false;

  constructor() {
    // Polled, since what holds a card back (route, story screens) isn't all reactive.
    const poll = setInterval(() => this.showNext(), CARD_POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(poll));

    effect((onCleanup) => {
      const card = this.cardElement()?.nativeElement;
      const shine = this.shineElement()?.nativeElement;
      if (!card || !shine) return;

      const glow = this.anim.goldGlow(card);
      const sparkle = this.anim.shimmer(shine);
      const dismissTimer = setTimeout(
        () => this.card.set(undefined),
        CARD_LINGER_MS,
      );
      onCleanup(() => {
        glow.pause();
        sparkle.cancel();
        clearTimeout(dismissTimer);
      });
    });
  }

  private showNext(): void {
    if (
      this.card() ||
      this.isLeaving ||
      document.hidden ||
      !this.loading.isReady() ||
      !this.achievements.hasQueued() ||
      achievementCardIsHeld()
    ) {
      return;
    }

    this.card.set(this.achievements.next());
  }

  public async onLeave(event: AnimationCallbackEvent): Promise<void> {
    this.isLeaving = true;
    try {
      await this.anim.shatterIntoSmoke(event.target);
    } catch {
      // A cancelled shatter still has to finish the leave below.
    } finally {
      this.isLeaving = false;
      event.animationComplete();
    }
  }
}
