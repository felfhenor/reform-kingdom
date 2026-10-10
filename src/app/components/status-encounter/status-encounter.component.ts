import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { StatusElementPoolComponent } from '@components/status-element-pool/status-element-pool.component';
import { StatusEncounterCombatantsComponent } from '@components/status-encounter-combatants/status-encounter-combatants.component';
import { StatusHeroComponent } from '@components/status-hero/status-hero.component';
import { worldCombatState } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-status-encounter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatusHeroComponent,
    StatusEncounterCombatantsComponent,
    StatusElementPoolComponent,
  ],
  template: `
    <div
      class="flex flex-row items-end gap-4"
      (mouseenter)="setHovered(true)"
      (mouseleave)="setHovered(false)"
    >
      @if (combat(); as combat) {
        <app-status-element-pool
          class="pointer-events-auto"
          [combat]="combat"
          [expanded]="isExpanded()"
          (animate.enter)="anim.fadeIn($event.target)"
        />
      }

      <div class="encounter-status">
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

  public anim = inject(AnimationService);

  public combat = computed(() => worldCombatState());
  public guardians = computed(() => worldCombatState()?.guardians ?? []);
  public helpers = computed(() => worldCombatState()?.helpers ?? []);

  public setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }
}
