import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CardStatusWorkerLevelupComponent } from '@components/card-status-worker-levelup/card-status-worker-levelup.component';
import { workersReadyToLevelUpEntries } from '@helpers/worker/worker-progression';

@Component({
  selector: 'app-status-worker-levelup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusWorkerLevelupComponent],
  template: `
    @if (entries().length > 0) {
      <div
        class="worker-levelup-status"
        (mouseenter)="setHovered(true)"
        (mouseleave)="setHovered(false)"
      >
        @for (entry of entries(); track entry.workerId) {
          <app-card-status-worker-levelup
            [entry]="entry"
            [expanded]="isHovered()"
          ></app-card-status-worker-levelup>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      pointer-events: none;
    }

    .worker-levelup-status {
      display: flex;
      gap: 8px;
      pointer-events: auto;
    }
  `,
})
export class StatusWorkerLevelupComponent {
  public isHovered = signal(false);

  public entries = computed(() => workersReadyToLevelUpEntries());

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
