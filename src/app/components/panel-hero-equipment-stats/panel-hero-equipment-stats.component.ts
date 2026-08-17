import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
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
  imports: [IconStatComponent, TippyDirective],
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

  public statValue(stat: BaseStat): number {
    return Math.round(this.character().stats[stat] * 10) / 10;
  }
}
