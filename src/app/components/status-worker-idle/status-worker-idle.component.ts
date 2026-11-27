import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CardStatusWorkerIdleComponent } from '@components/card-status-worker-idle/card-status-worker-idle.component';
import { workersIdleStatusEntries } from '@helpers/worker/worker-progression.ui';

@Component({
  selector: 'app-status-worker-idle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusWorkerIdleComponent],
  template: `
    @if (entries().length > 0) {
      <div
        class="flex gap-2 pointer-events-auto"
        (mouseenter)="setHovered(true)"
        (mouseleave)="setHovered(false)"
        (focusin)="setHovered(true)"
        (focusout)="setHovered(false)"
      >
        @for (entry of entries(); track entry.workerId) {
          <app-card-status-worker-idle
            [entry]="entry"
            [expanded]="isHovered()"
          ></app-card-status-worker-idle>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
      pointer-events: none;
    }
  `,
})
export class StatusWorkerIdleComponent {
  public isHovered = signal(false);

  public entries = computed(() => workersIdleStatusEntries());

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
