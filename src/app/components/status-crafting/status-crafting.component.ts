import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CardStatusCraftingComponent } from '@components/card-status-crafting/card-status-crafting.component';
import { craftingActiveStatusEntries } from '@helpers/crafting/crafting';
import { uiClockTick } from '@helpers/engine/ui';
import { getOption } from '@helpers/state-options';

@Component({
  selector: 'app-status-crafting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardStatusCraftingComponent],
  template: `
    @if (entries().length > 0) {
      <div
        class="crafting-status"
        (mouseenter)="setHovered(true)"
        (mouseleave)="setHovered(false)"
      >
        @for (entry of entries(); track entry.tradeskillId) {
          <app-card-status-crafting
            [entry]="entry"
            [expanded]="isExpanded()"
          ></app-card-status-crafting>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      pointer-events: none;
    }

    .crafting-status {
      display: flex;
      gap: 8px;
      pointer-events: auto;
    }
  `,
})
export class StatusCraftingComponent {
  // Ignored once `craftingViewAlwaysExpand` is on - the corner then stays
  // expanded regardless of hover state.
  private isHovered = signal(false);

  // Recomputes once a second (via `uiClockTick`) so the remaining-time text
  // never looks frozen even if the gameloop skips a tick.
  public entries = computed(() => {
    uiClockTick();
    return craftingActiveStatusEntries();
  });

  public isExpanded = computed(
    () => getOption('craftingViewAlwaysExpand') || this.isHovered(),
  );

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
