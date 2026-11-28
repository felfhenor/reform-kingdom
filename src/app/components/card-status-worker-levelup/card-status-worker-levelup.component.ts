import { TPipe } from '@pipes/t.pipe';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { CardStatusBubbleComponent } from '@components/card-status-bubble/card-status-bubble.component';
import { workerPageOpen } from '@helpers/engine/ui';
import type { WorkerLevelUpStatusEntry } from '@interfaces';

@Component({
  selector: 'app-card-status-worker-levelup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    AtlasAnimationComponent,
    CardStatusBubbleComponent,
    DecimalPipe,
  ],
  templateUrl: './card-status-worker-levelup.component.html',
  styleUrl: './card-status-worker-levelup.component.scss',
})
export class CardStatusWorkerLevelupComponent {
  public entry = input.required<WorkerLevelUpStatusEntry>();
  public expanded = input<boolean>(false);

  public goToWorker() {
    workerPageOpen(this.entry().workerId);
  }
}
