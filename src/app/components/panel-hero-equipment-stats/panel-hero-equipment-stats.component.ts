import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
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
  type Character,
  type StatDisplayDimension,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { StatDisplayPipe } from '@pipes/stat-display.pipe';

@Component({
  selector: 'app-panel-hero-equipment-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IconComponent,
    IconStatComponent,
    TippyDirective,
    StatDisplayPipe,
  ],
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
