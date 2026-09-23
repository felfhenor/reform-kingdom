import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  type Signal,
} from '@angular/core';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { IconComponent } from '@components/icon/icon.component';
import { characterTagResistances } from '@helpers/item/equipment';
import { characterCombatStatTotals } from '@helpers/item/equipment.ui';
import {
  CombatStatDimension,
  StatInformation,
  StatOrder,
  StatShorthand,
  StatusEffectTagDimension,
  type BaseStat,
  type Character,
  type CombatStat,
  type StatDisplayDimension,
  type StatusEffectTag,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { injectTweenedNumber } from '@services/animation.service';

@Component({
  selector: 'app-panel-hero-equipment-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconComponent, IconStatComponent, TippyDirective],
  host: {
    class: 'flex flex-col min-h-0 pb-8',
  },
  templateUrl: './panel-hero-equipment-stats.component.html',
})
export class PanelHeroEquipmentStatsComponent {
  public character = input.required<Character>();

  public statKeys = StatOrder;
  public statShorthand = StatShorthand;
  public statInformation = StatInformation;
  public resistanceDimension = StatusEffectTagDimension;
  public combatStatDimension = CombatStatDimension;

  // Gear-only, same as the stats above - the temporary Astral Projector
  // buff is combat-time only and intentionally not reflected here.
  public resistances = computed(() =>
    characterTagResistances(this.character()),
  );

  public combatStats = computed(() =>
    characterCombatStatTotals(this.character()),
  );

  public resistanceRows = computed(() =>
    this.nonzeroRows(this.resistanceDimension, this.resistances()),
  );

  public combatStatRows = computed(() =>
    this.nonzeroRows(this.combatStatDimension, this.combatStats()),
  );

  // Fixed key sets, so each stat's tween is created once here rather than per
  // @for row - injectTweenedNumber needs a stable injection context to attach to.
  private tweenedStats = Object.fromEntries(
    StatOrder.map((stat) => [
      stat,
      injectTweenedNumber(() => this.character().stats[stat]),
    ]),
  ) as Record<BaseStat, Signal<number>>;

  private tweenedCombatStats = Object.fromEntries(
    CombatStatDimension.order.map((stat) => [
      stat,
      injectTweenedNumber(() => this.combatStats()[stat] ?? 0),
    ]),
  ) as Record<CombatStat, Signal<number>>;

  private tweenedResistances = Object.fromEntries(
    StatusEffectTagDimension.order.map((stat) => [
      stat,
      injectTweenedNumber(() => this.resistances()[stat] ?? 0),
    ]),
  ) as Record<StatusEffectTag, Signal<number>>;

  public tweenedStatValue(stat: BaseStat): number {
    return this.tweenedStats[stat]();
  }

  public tweenedCombatStatValue(stat: CombatStat): number {
    return this.tweenedCombatStats[stat]();
  }

  public tweenedResistanceValue(stat: StatusEffectTag): number {
    return this.tweenedResistances[stat]();
  }

  public suffix(dimension: StatDisplayDimension, key: string): string {
    return (dimension.isPercent?.[key] ?? true) ? '%' : '';
  }

  private nonzeroRows<K extends string>(
    dimension: StatDisplayDimension<K>,
    values: Record<K, number>,
  ): K[] {
    return dimension.order.filter((key) => (values[key] ?? 0) !== 0);
  }
}
