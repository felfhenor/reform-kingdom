import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { StatusHelperComponent } from '@components/status-helper/status-helper.component';
import { StatusHeroComponent } from '@components/status-hero/status-hero.component';
import { StatusMonsterComponent } from '@components/status-monster/status-monster.component';
import { worldCombatState } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';

@Component({
  selector: 'app-status-encounter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusHeroComponent, StatusHelperComponent, StatusMonsterComponent],
  template: `
    <div
      class="encounter-status"
      (mouseenter)="setHovered(true)"
      (mouseleave)="setHovered(false)"
    >
      <app-status-hero [expanded]="isExpanded()"></app-status-hero>

      @if (hasHelpers()) {
        <app-status-helper [expanded]="isExpanded()"></app-status-helper>
      }

      @if (hasEnemies()) {
        <app-status-monster [expanded]="isExpanded()"></app-status-monster>
      }
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
  // Ignored once `partyViewAlwaysExpand` is on - the corner then stays
  // expanded regardless of hover state.
  private isHovered = signal(false);

  public isExpanded = computed(
    () => getOption('partyViewAlwaysExpand') || this.isHovered(),
  );

  public hasEnemies = computed(
    () => (worldCombatState()?.guardians ?? []).length > 0,
  );
  public hasHelpers = computed(
    () => (worldCombatState()?.helpers ?? []).length > 0,
  );

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
