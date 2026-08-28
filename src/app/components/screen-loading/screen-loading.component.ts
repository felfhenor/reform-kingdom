import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { LoadingService } from '@services/loading.service';

@Component({
  selector: 'app-screen-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarProgressComponent],
  template: `
    @let progress = loadingService.progress();

    <div
      class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-base-100"
    >
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <app-bar-progress
        class="w-64"
        color="primary"
        [value]="progress.percent"
      />
      <p class="text-sm text-lighter">{{ progress.label }}</p>
    </div>
  `,
})
export class ScreenLoadingComponent {
  protected loadingService = inject(LoadingService);
}
