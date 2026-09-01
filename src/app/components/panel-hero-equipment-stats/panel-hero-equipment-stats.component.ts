import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import { RowLabeledValuesComponent } from '@components/row-labeled-values/row-labeled-values.component';
import {
  characterCombatStatTotals,
  characterTagResistances,
} from '@helpers/item/equipment';
import {
  CombatStatDimension,
  StatInformation,
  StatOrder,
  StatShorthand,
  StatusEffectTagDimension,
  type Character,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-hero-equipment-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IconStatComponent,
    RowLabeledValuesComponent,
    TippyDirective,
  ],
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
}
