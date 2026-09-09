import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';
import { combatOrdersModalOpen } from '@helpers/engine/ui';
import type { CharacterId } from '@interfaces';

@Component({
  selector: 'app-button-hero-combat-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective],
  template: `
    <button
      class="btn btn-sm btn-secondary"
      (click)="open()"
      appSfx="ui-click"
      [sfxOffset]="0"
      [sfxTrigger]="['click', 'hover']"
    >
      Combat Orders
    </button>
  `,
})
export class ButtonHeroCombatOrdersComponent {
  public characterId = input.required<CharacterId>();

  public open(): void {
    combatOrdersModalOpen(this.characterId());
  }
}
