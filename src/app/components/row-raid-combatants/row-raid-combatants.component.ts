import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { TooltipMonsterPreviewComponent } from '@components/tooltip-monster-preview/tooltip-monster-preview.component';
import { raidCombatantCount } from '@helpers/town/raid/town-raid-state.ui';
import type { TownRaidCombatantRow } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-row-raid-combatants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    SlotIconBlankComponent,
    AtlasAnimationComponent,
    TippyDirective,
    TooltipMonsterPreviewComponent,
  ],
  templateUrl: './row-raid-combatants.component.html',
  host: { class: 'flex flex-col gap-2' },
})
export class RowRaidCombatantsComponent {
  public label = input.required<string>();
  public isEnemy = input<boolean>(true);
  public combatants = input.required<TownRaidCombatantRow[]>();

  public total = computed(() => raidCombatantCount(this.combatants()));
}
