import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SFXDirective } from '@directives/sfx.directive';
import { OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL } from '@helpers/config';
import { canSetHomeNode, homeNodeGet } from '@helpers/town/town-spawn';
import { isPartyAtNode } from '@helpers/world';
import { worldNodeCanAffordCost } from '@helpers/world-node/world-node-cost';
import {
  worldNodeDevelopmentIsMaxLevel,
  worldNodeDevelopmentLevelUpCost,
} from '@helpers/world-node/world-node-development';
import {
  isOutpostBuilt,
  outpostDeathPenaltyMultiplier,
  worldNodeOutpostLevel,
} from '@helpers/world-node/world-node-outpost';
import { worldNodeOutpost } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-actions-outpost',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, SFXDirective, RowCurrencyCostComponent],
  templateUrl: './panel-map-node-actions-outpost.component.html',
  styleUrl: './panel-map-node-actions-outpost.component.scss',
})
export class PanelMapNodeActionsOutpostComponent {
  public entry = input.required<WorldNodeEntry>();

  public develop = output<void>();
  public setHome = output<void>();

  private outpost = computed(() => worldNodeOutpost(this.entry()));

  private level = computed(() => worldNodeOutpostLevel(this.entry().nodeName));

  public isBuilt = computed(() => isOutpostBuilt(this.entry().nodeName));

  public isMaxLevel = computed(() => {
    const outpost = this.outpost();
    return !outpost || worldNodeDevelopmentIsMaxLevel(outpost, this.level());
  });

  public cost = computed(() => {
    const outpost = this.outpost();
    if (!outpost) return [];

    return worldNodeDevelopmentLevelUpCost(outpost, this.level());
  });

  public canDevelop = computed(() => {
    if (this.isMaxLevel()) return false;

    return (
      isPartyAtNode(this.entry().nodeName) &&
      worldNodeCanAffordCost(this.cost())
    );
  });

  public isHome = computed(
    () => homeNodeGet()?.nodeName === this.entry().nodeName,
  );

  public canSetHome = computed(
    () => !this.isHome() && canSetHomeNode(this.entry()),
  );

  public reductionPercent = computed(
    () => (1 - outpostDeathPenaltyMultiplier(this.entry().nodeName)) * 100,
  );

  public reductionPerLevelPercent =
    OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL * 100;
}
