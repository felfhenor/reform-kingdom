import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import type { TownRaidCombatantRow } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-raid-combatants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotIconBlankComponent, AtlasAnimationComponent, TippyDirective],
  templateUrl: './row-raid-combatants.component.html',
  host: { class: 'flex flex-col gap-2' },
})
export class RowRaidCombatantsComponent {
  public label = input.required<string>();
  public combatants = input.required<TownRaidCombatantRow[]>();
}
