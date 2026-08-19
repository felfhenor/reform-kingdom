import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { StatusHeroComponent } from '@components/status-hero/status-hero.component';
import { StatusMonsterComponent } from '@components/status-monster/status-monster.component';
import { getOption } from '@helpers/state-options';

@Component({
  selector: 'app-status-encounter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusHeroComponent, StatusMonsterComponent],
  template: `
    <div
      class="encounter-status"
      (mouseenter)="setHovered(true)"
      (mouseleave)="setHovered(false)"
    >
      <app-status-hero [expanded]="isExpanded()"></app-status-hero>
      <app-status-monster [expanded]="isExpanded()"></app-status-monster>
    </div>
  `,
  styles: `
    :host {
      display: block;
      pointer-events: none;
    }

    // Column-reverse so the first DOM child (hero row) anchors at the
    // bottom and the monster rows stack upward above it.
    .encounter-status {
      display: flex;
      flex-direction: column-reverse;
      gap: 96px;
      pointer-events: auto;
    }
  `,
})
export class StatusEncounterComponent {
  // Only used when `partyViewAutoCollapse` is on - otherwise the corner
  // stays expanded regardless of hover state.
  private isHovered = signal(false);

  public isExpanded = computed(
    () => !getOption('partyViewAutoCollapse') || this.isHovered(),
  );

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
