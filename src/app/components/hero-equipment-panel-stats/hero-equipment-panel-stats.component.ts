import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  IconStatComponent,
  STAT_SHORTHAND,
} from '@components/icon-stat/icon-stat.component';
import type { BaseStat, Character } from '@interfaces';

const STAT_KEYS: BaseStat[] = [
  'Health',
  'Energy',
  'Strength',
  'Intelligence',
  'Vitality',
  'Resistance',
  'Agility',
  'Luck',
];

@Component({
  selector: 'app-hero-equipment-panel-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconStatComponent],
  host: {
    class: 'flex flex-col gap-2',
  },
  templateUrl: './hero-equipment-panel-stats.component.html',
})
export class HeroEquipmentPanelStatsComponent {
  public character = input.required<Character>();

  public statKeys = STAT_KEYS;
  public statShorthand = STAT_SHORTHAND;

  public statValue(stat: BaseStat): number {
    return Math.round(this.character().stats[stat] * 10) / 10;
  }
}
