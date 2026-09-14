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
import { worldNodeCanAffordCost } from '@helpers/world-node/world-node-cost';
import {
  isPartyAtShrine,
  worldNodeShrineCurrentTier,
  worldNodeShrineIsMaxLevel,
  worldNodeShrineLevelUpCost,
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

  public isMaxLevel = computed(() => {
    const shrine = this.shrine();
    return !shrine || worldNodeShrineIsMaxLevel(shrine, this.entry().nodeName);
  });

  public cost = computed(() => {
    const shrine = this.shrine();
    if (!shrine) return [];

    return worldNodeShrineLevelUpCost(shrine, this.entry().nodeName);
  });

  public canDevelop = computed(() => {
    if (this.isMaxLevel()) return false;

    return (
      isPartyAtShrine(this.entry().nodeName) &&
      worldNodeCanAffordCost(this.cost())
    );
  });

  public canPray = computed(
    () => isPartyAtShrine(this.entry().nodeName) && !!this.currentBuffName(),
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
