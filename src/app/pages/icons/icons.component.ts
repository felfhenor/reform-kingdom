import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { ICON_SIZE_VALUES } from '@helpers/engine/icons';
import type { BaseStat, Icon, IconSize } from '@interfaces';
import {
  CombatStatDimension,
  StatOrder,
  StatusEffectTagDimension,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

type IconEntry = {
  name: string;
  icon: Icon;
};

type IconCategory = {
  title: string;
  entries: IconEntry[];
};

// Every IconSize token, small to large - 'badge' is skipped since it's
// indistinguishable from 'inline' at a glance.
const ICON_SIZES: IconSize[] = ['inline', 'row', 'stat', 'nav'];

@Component({
  selector: 'app-icons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, IconStatComponent, TippyDirective],
  templateUrl: './icons.component.html',
  styleUrl: './icons.component.scss',
})
export class IconsComponent {
  public sizes = ICON_SIZES;
  public sizeValues = ICON_SIZE_VALUES;

  public stats: BaseStat[] = StatOrder;

  public iconCategories: IconCategory[] = [
    {
      title: 'Combat Stats',
      entries: CombatStatDimension.order.map((key) => ({
        name: CombatStatDimension.label[key],
        icon: CombatStatDimension.icon[key],
      })),
    },
    {
      title: 'Resistances',
      entries: StatusEffectTagDimension.order.map((key) => ({
        name: StatusEffectTagDimension.label[key],
        icon: StatusEffectTagDimension.icon[key],
      })),
    },
  ];
}
