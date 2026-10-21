import {
  afterNextRender,
  type AnimationCallbackEvent,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { ScreenLoadingBackdropComponent } from '@components/screen-loading-backdrop/screen-loading-backdrop.component';
import { getEntriesByType } from '@helpers/content/content';
import { LOADING_HERO_CYCLE_MS } from '@helpers/config';
import { rngChoice, rngChoiceOther } from '@helpers/rng';
import type { JobContent } from '@interfaces';
import { AnimationService } from '@services/animation.service';
import { ContentService } from '@services/content.service';
import { LoadingService } from '@services/loading.service';

@Component({
  selector: 'app-screen-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasAnimationComponent,
    BarProgressComponent,
    ScreenLoadingBackdropComponent,
  ],
  templateUrl: './screen-loading.component.html',
})
export class ScreenLoadingComponent {
  protected anim = inject(AnimationService);
  protected loadingService = inject(LoadingService);
  private contentService = inject(ContentService);

  private heroEl = viewChild.required<ElementRef<HTMLElement>>('hero');

  // Sprites can't render until their atlas lands, which may be after the data.
  private jobs = computed(() =>
    this.contentService.hasLoadedData() &&
    this.contentService.hasLoadedAtlases()
      ? getEntriesByType<JobContent>('job')
      : [],
  );

  protected heroJob = linkedSignal<JobContent | undefined>(() =>
    this.jobs().length > 0 ? rngChoice(this.jobs()) : undefined,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    const cycleTimer = setInterval(() => {
      const current = this.heroJob();
      if (current) this.heroJob.set(rngChoiceOther(this.jobs(), current));
    }, LOADING_HERO_CYCLE_MS);

    afterNextRender(() => {
      if (this.anim.reducedMotion) return;
      const bob = this.anim.bob(this.heroEl().nativeElement);
      destroyRef.onDestroy(() => bob.revert());
    });

    destroyRef.onDestroy(() => clearInterval(cycleTimer));
  }

  protected onHeroEnter(event: AnimationCallbackEvent): void {
    if (!this.anim.reducedMotion) this.anim.iconSwapIn(event.target);
  }

  protected onHeroLeave(event: AnimationCallbackEvent): void {
    if (this.anim.reducedMotion) {
      event.animationComplete();
      return;
    }

    this.anim
      .iconSwapOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}
