import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { StatusEncounterCombatantsComponent } from '@components/status-encounter-combatants/status-encounter-combatants.component';
import { StatusHeroComponent } from '@components/status-hero/status-hero.component';
import { worldCombatState } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';

@Component({
  selector: 'app-status-encounter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusHeroComponent, StatusEncounterCombatantsComponent],
  template: `
    <div
      class="encounter-status"
      (mouseenter)="setHovered(true)"
      (mouseleave)="setHovered(false)"
    >
      <app-status-hero [expanded]="isExpanded()"></app-status-hero>

      @if (helpers().length > 0) {
        <app-status-encounter-combatants
          [combatants]="helpers()"
          [expanded]="isExpanded()"
        ></app-status-encounter-combatants>
      }

      @if (guardians().length > 0) {
        <app-status-encounter-combatants
          [combatants]="guardians()"
          [expanded]="isExpanded()"
          [slideIn]="true"
        ></app-status-encounter-combatants>
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

  public guardians = computed(() => worldCombatState()?.guardians ?? []);
  public helpers = computed(() => worldCombatState()?.helpers ?? []);

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
