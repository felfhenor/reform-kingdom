import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconDimensionComponent } from '@components/icon-dimension/icon-dimension.component';
import { ICON_SIZE_VALUES } from '@helpers/engine/icons';
import type { BaseStat, IconSize } from '@interfaces';
import {
  CombatStatDimension,
  ElementResistanceDimension,
  MonsterTypeDimension,
  StatDimension,
  StatOrder,
  StatusEffectTagDimension,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

// Every IconSize token, small to large - 'badge' is skipped since it's
// indistinguishable from 'inline' at a glance.
const ICON_SIZES: IconSize[] = ['inline', 'row', 'stat', 'nav'];

@Component({
  selector: 'app-icons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconDimensionComponent, TippyDirective],
  templateUrl: './icons.component.html',
  styleUrl: './icons.component.scss',
})
export class IconsComponent {
  public sizes = ICON_SIZES;
  public sizeValues = ICON_SIZE_VALUES;

  public stats: BaseStat[] = StatOrder;
  public statDimension = StatDimension;
  public resistanceDimension = StatusEffectTagDimension;

  public iconCategories = [
    {
      title: 'Stats',
      dimension: StatDimension,
    },
    {
      title: 'Combat Stats',
      dimension: CombatStatDimension,
    },
    {
      title: 'Resistances',
      dimension: StatusEffectTagDimension,
    },
    {
      title: 'Elements',
      dimension: ElementResistanceDimension,
    },
    {
      title: 'Monster Types',
      dimension: MonsterTypeDimension,
    },
  ];
}
