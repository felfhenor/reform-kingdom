import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CardStatusTutorialUnlockComponent } from '@components/card-status-tutorial-unlock/card-status-tutorial-unlock.component';
import { tutorialsPendingEntries } from '@helpers/tutorial/tutorial-engine.ui';

@Component({
  selector: 'app-status-tutorial-unlock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusTutorialUnlockComponent],
  template: `
    @if (entries().length > 0) {
      <div
        class="tutorial-unlock-status"
        (mouseenter)="setHovered(true)"
        (mouseleave)="setHovered(false)"
      >
        @for (entry of entries(); track entry.tutorialId) {
          <app-card-status-tutorial-unlock
            [entry]="entry"
            [expanded]="isHovered()"
          ></app-card-status-tutorial-unlock>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      pointer-events: none;
    }

    .tutorial-unlock-status {
      display: flex;
      gap: 8px;
      pointer-events: auto;
    }
  `,
})
export class StatusTutorialUnlockComponent {
  public isHovered = signal(false);

  public entries = computed(() => tutorialsPendingEntries());

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
