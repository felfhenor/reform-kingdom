import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SFXDirective } from '@directives/sfx.directive';
import {
  isPartyAtGatherNode,
  worldNodeCanAffordLevelUpCost,
  worldNodeIsMaxLevel,
  worldNodeLevelUpCost,
} from '@helpers/world-node/world-node-level';
import { worldNodeGathering } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-actions-gather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective, RowCurrencyCostComponent],
  templateUrl: './panel-map-node-actions-gather.component.html',
  styleUrl: './panel-map-node-actions-gather.component.scss',
})
export class PanelMapNodeActionsGatherComponent {
  public entry = input.required<WorldNodeEntry>();

  public develop = output<void>();

  private gathering = computed(() => worldNodeGathering(this.entry()));

  public isMaxLevel = computed(() => {
    const gathering = this.gathering();
    return !gathering || worldNodeIsMaxLevel(gathering, this.entry().nodeName);
  });

  public cost = computed(() => {
    const gathering = this.gathering();
    if (!gathering) return [];

    return worldNodeLevelUpCost(gathering, this.entry().nodeName);
  });

  public costRow = computed(() =>
    this.cost().map((cost) => ({ type: cost.itemId, amount: cost.required })),
  );

  public canDevelop = computed(() => {
    if (this.isMaxLevel()) return false;

    return (
      isPartyAtGatherNode(this.entry().nodeName) &&
      worldNodeCanAffordLevelUpCost(this.cost())
    );
  });
}
