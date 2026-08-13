import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LoadingService } from '@services/loading.service';

@Component({
  selector: 'app-screen-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let progress = loadingService.progress();

    <div
      class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-base-100"
    >
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <progress
        class="progress progress-primary w-64"
        [value]="progress.percent"
        max="100"
      ></progress>
      <p class="text-sm text-lighter">{{ progress.label }}</p>
    </div>
  `,
})
export class ScreenLoadingComponent {
  protected loadingService = inject(LoadingService);
}
