import { TPipe } from '@pipes/t.pipe';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { combatOrdersModalOpen } from '@helpers/engine/ui';
import type { CharacterId } from '@interfaces';

@Component({
  selector: 'app-button-hero-combat-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, SFXDirective, TutorialTargetDirective],
  template: `
    <button
      class="btn btn-sm btn-neutral"
      (click)="open()"
      appTutorialTarget="hero-combat-orders"
      appSfx="ui-click"
      [sfxOffset]="0"
      [sfxTrigger]="['click', 'hover']"
    >
      {{ 'buttonHeroCombatOrders.combatOrders' | t }}
    </button>
  `,
})
export class ButtonHeroCombatOrdersComponent {
  public characterId = input.required<CharacterId>();

  public open(): void {
    combatOrdersModalOpen(this.characterId());
  }
}
