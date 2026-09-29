import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { notifySuccess } from '@helpers/engine/notify';
import { isPartyAtNode } from '@helpers/world';
import { worldNodeCanAffordCost } from '@helpers/world-node/world-node-cost';
import {
  worldNodeDevelopmentIsMaxLevel,
  worldNodeDevelopmentLevelUpCost,
} from '@helpers/world-node/world-node-development';
import {
  worldNodeShrineCurrentTier,
  worldNodeShrineLevel,
} from '@helpers/world-node/world-node-shrine';
import { worldNodeShrine } from '@helpers/world-node/world-nodes';
import type { GlobalEffectContent, WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-actions-shrine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective, RowCurrencyCostComponent],
  templateUrl: './panel-map-node-actions-shrine.component.html',
  styleUrl: './panel-map-node-actions-shrine.component.scss',
})
export class PanelMapNodeActionsShrineComponent {
  public entry = input.required<WorldNodeEntry>();

  public develop = output<void>();
  public pray = output<void>();

  private shrine = computed(() => worldNodeShrine(this.entry()));

  private level = computed(() => worldNodeShrineLevel(this.entry().nodeName));

  public isMaxLevel = computed(() => {
    const shrine = this.shrine();
    return !shrine || worldNodeDevelopmentIsMaxLevel(shrine, this.level());
  });

  public cost = computed(() => {
    const shrine = this.shrine();
    if (!shrine) return [];

    return worldNodeDevelopmentLevelUpCost(shrine, this.level());
  });

  public canDevelop = computed(() => {
    if (this.isMaxLevel()) return false;

    return (
      isPartyAtNode(this.entry().nodeName) &&
      worldNodeCanAffordCost(this.cost())
    );
  });

  public canPray = computed(
    () => isPartyAtNode(this.entry().nodeName) && !!this.currentBuffName(),
  );

  public currentBuffName = computed(() => {
    const shrine = this.shrine();
    if (!shrine) return undefined;

    const tier = worldNodeShrineCurrentTier(shrine, this.entry().nodeName);
    if (!tier) return undefined;

    return getEntry<GlobalEffectContent>(tier.globalEffectId)?.name;
  });

  doPray() {
    this.pray.emit();

    notifySuccess('You pray at the shrine!');
  }
}
