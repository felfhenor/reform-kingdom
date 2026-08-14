import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { combatOrdersModalOpen } from '@helpers/ui';
import type { CharacterId } from '@interfaces';

@Component({
  selector: 'app-button-hero-combat-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <button class="btn btn-sm btn-secondary" (click)="open()">
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
