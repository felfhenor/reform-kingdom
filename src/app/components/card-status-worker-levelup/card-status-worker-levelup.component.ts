import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import type { WorkerLevelUpStatusEntry } from '@interfaces';

@Component({
  selector: 'app-card-status-worker-levelup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasAnimationComponent],
  templateUrl: './card-status-worker-levelup.component.html',
  styleUrl: './card-status-worker-levelup.component.scss',
})
export class CardStatusWorkerLevelupComponent {
  public entry = input.required<WorkerLevelUpStatusEntry>();
  public expanded = input<boolean>(false);
}
