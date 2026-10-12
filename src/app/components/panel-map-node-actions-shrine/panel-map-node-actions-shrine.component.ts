import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonWorldNodeDevelopComponent } from '@components/button-world-node-develop/button-world-node-develop.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { notifySuccess } from '@helpers/engine/notify';
import { isPartyAtNode } from '@helpers/world';
import { worldNodeShrineCurrentTier } from '@helpers/world-node/world-node-shrine';
import { worldNodeShrine } from '@helpers/world-node/world-nodes';
import type { GlobalEffectContent, WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-actions-shrine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective, ButtonWorldNodeDevelopComponent],
  templateUrl: './panel-map-node-actions-shrine.component.html',
  styleUrl: './panel-map-node-actions-shrine.component.scss',
})
export class PanelMapNodeActionsShrineComponent {
  public entry = input.required<WorldNodeEntry>();

  public pray = output<void>();

  private shrine = computed(() => worldNodeShrine(this.entry()));

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
