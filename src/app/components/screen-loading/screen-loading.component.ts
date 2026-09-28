import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { AnimationService } from '@services/animation.service';
import { LoadingService } from '@services/loading.service';

@Component({
  selector: 'app-screen-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarProgressComponent],
  template: `
    @let progress = loadingService.progress();

    <div
      class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-base-100 p-8 px-[30%]"
    >
      <app-bar-progress
        class="w-[50%]"
        color="primary"
        [shimmer]="true"
        [value]="progress.percent"
        (filled)="loadingService.onBarFilled()"
      />

      @for (label of [progress.label]; track $index) {
        <p class="type-muted" (animate.enter)="anim.slideIn($event.target)">
          {{ label }}
        </p>
      }
    </div>
  `,
})
export class ScreenLoadingComponent {
  protected anim = inject(AnimationService);
  protected loadingService = inject(LoadingService);
}
