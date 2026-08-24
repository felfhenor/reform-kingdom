import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { RowDebuffResistancesComponent } from '@components/row-debuff-resistances/row-debuff-resistances.component';
import { characterTagResistances } from '@helpers/item/equipment';
import {
  StatInformation,
  StatOrder,
  StatShorthand,
  type BaseStat,
  type Character,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-hero-equipment-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconStatComponent, RowDebuffResistancesComponent, TippyDirective],
  host: {
    class: 'flex flex-col gap-2',
  },
  templateUrl: './panel-hero-equipment-stats.component.html',
})
export class PanelHeroEquipmentStatsComponent {
  public character = input.required<Character>();

  public statKeys = StatOrder;
  public statShorthand = StatShorthand;
  public statInformation = StatInformation;

  // Gear-only, same as the stats above - the temporary Astral Projector
  // buff is combat-time only and intentionally not reflected here.
  public resistances = computed(() =>
    characterTagResistances(this.character()),
  );

  public statValue(stat: BaseStat): number {
    return Math.round(this.character().stats[stat] * 10) / 10;
  }
}
