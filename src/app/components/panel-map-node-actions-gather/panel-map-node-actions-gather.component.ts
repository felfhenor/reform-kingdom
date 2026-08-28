import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { SFXDirective } from '@directives/sfx.directive';
import { goldCoinId, hasGold } from '@helpers/item/materials';
import {
  isPartyAtGatherNode,
  worldNodeIsMaxLevel,
  worldNodeLevelUpCost,
} from '@helpers/world-node/world-node-level';
import { worldNodeGathering } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-map-node-actions-gather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective, CurrencyCostComponent, TippyDirective],
  templateUrl: './panel-map-node-actions-gather.component.html',
  styleUrl: './panel-map-node-actions-gather.component.scss',
})
export class PanelMapNodeActionsGatherComponent {
  public entry = input.required<WorldNodeEntry>();

  public develop = output<void>();

  public goldItemId = goldCoinId();

  private gathering = computed(() => worldNodeGathering(this.entry()));

  public isMaxLevel = computed(() => {
    const gathering = this.gathering();
    return !gathering || worldNodeIsMaxLevel(gathering, this.entry().nodeName);
  });

  public cost = computed(() => {
    const gathering = this.gathering();
    if (!gathering) return 0;

    return worldNodeLevelUpCost(gathering, this.entry().nodeName);
  });

  public canDevelop = computed(() => {
    if (this.isMaxLevel()) return false;

    return (
      isPartyAtGatherNode(this.entry().nodeName) && hasGold(this.cost())
    );
  });
}
