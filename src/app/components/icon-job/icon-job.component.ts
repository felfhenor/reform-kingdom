import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import type { JobContent } from '@interfaces';

@Component({
  selector: 'app-icon-job',
  imports: [AtlasAnimationComponent],
  templateUrl: './icon-job.component.html',
  styleUrl: './icon-job.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconJobComponent {
  public job = input<JobContent>();
}
