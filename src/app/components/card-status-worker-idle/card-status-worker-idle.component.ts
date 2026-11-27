import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { CardStatusBubbleComponent } from '@components/card-status-bubble/card-status-bubble.component';
import { workerPageOpen } from '@helpers/engine/ui';
import type { WorkerIdleStatusEntry } from '@interfaces';

@Component({
  selector: 'app-card-status-worker-idle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasAnimationComponent, CardStatusBubbleComponent],
  templateUrl: './card-status-worker-idle.component.html',
  styleUrl: './card-status-worker-idle.component.scss',
})
export class CardStatusWorkerIdleComponent {
  public entry = input.required<WorkerIdleStatusEntry>();
  public expanded = input<boolean>(false);

  public goToWorker() {
    workerPageOpen(this.entry().workerId);
  }
}
