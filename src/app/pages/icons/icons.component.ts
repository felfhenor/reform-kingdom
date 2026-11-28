import {
  CombatStatDimension,
  ElementResistanceDimension,
  MonsterTypeDimension,
  StatDimension,
  StatusEffectTagDimension,
} from '@helpers/hero/stat-dimension';
import { t } from '@helpers/i18n/i18n';
import { TPipe } from '@pipes/t.pipe';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconDimensionComponent } from '@components/icon-dimension/icon-dimension.component';
import { ICON_SIZE_VALUES } from '@helpers/engine/icons';
import type { BaseStat, IconSize } from '@interfaces';
import { StatOrder } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

// Every IconSize token, small to large - 'badge' is skipped since it's
// indistinguishable from 'inline' at a glance.
const ICON_SIZES: IconSize[] = ['inline', 'row', 'stat', 'nav'];

@Component({
  selector: 'app-icons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconDimensionComponent, TippyDirective],
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
      title: t('icons.stats'),
      dimension: StatDimension,
    },
    {
      title: t('icons.combatStats'),
      dimension: CombatStatDimension,
    },
    {
      title: t('icons.resistances'),
      dimension: StatusEffectTagDimension,
    },
    {
      title: t('icons.elements'),
      dimension: ElementResistanceDimension,
    },
    {
      title: t('icons.monsterTypes'),
      dimension: MonsterTypeDimension,
    },
  ];
}
