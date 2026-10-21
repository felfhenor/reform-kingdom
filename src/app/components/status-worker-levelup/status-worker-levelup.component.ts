import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CardStatusWorkerLevelupComponent } from '@components/card-status-worker-levelup/card-status-worker-levelup.component';
import { workersLevelUpStatusEntries } from '@helpers/worker/worker-progression.ui';

@Component({
  selector: 'app-status-worker-levelup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusWorkerLevelupComponent],
  template: `
    @if (entries().length > 0) {
      <div
        class="flex gap-2 pointer-events-auto"
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
  `,
})
export class StatusWorkerLevelupComponent {
  public isHovered = signal(false);

  public entries = computed(() => workersLevelUpStatusEntries());

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
