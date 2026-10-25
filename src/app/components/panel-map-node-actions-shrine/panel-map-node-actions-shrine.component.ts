import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { ButtonWorldNodeDevelopComponent } from '@components/button-world-node-develop/button-world-node-develop.component';
import { TooltipGlobalEffectComponent } from '@components/tooltip-global-effect/tooltip-global-effect.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { formatDuration } from '@helpers/engine/timer';
import { isPartyAtNode } from '@helpers/world';
import {
  shrinePrayerCooldownRemaining,
  worldNodeShrineCurrentTier,
} from '@helpers/world-node/world-node-shrine';
import { worldNodeShrine } from '@helpers/world-node/world-nodes';
import type { GlobalEffectContent, WorldNodeEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-map-node-actions-shrine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    ButtonWorldNodeDevelopComponent,
    SFXDirective,
    TippyDirective,
    TooltipGlobalEffectComponent,
  ],
  templateUrl: './panel-map-node-actions-shrine.component.html',
  styleUrl: './panel-map-node-actions-shrine.component.scss',
})
export class PanelMapNodeActionsShrineComponent {
  public entry = input.required<WorldNodeEntry>();

  public pray = output<void>();

  private shrine = computed(() => worldNodeShrine(this.entry()));

  public cooldownLabel = computed(() => {
    const remaining = shrinePrayerCooldownRemaining();
    return remaining > 0 ? formatDuration(remaining) : undefined;
  });

  public canPray = computed(
    () =>
      isPartyAtNode(this.entry().nodeName) &&
      !!this.currentBuff() &&
      !this.cooldownLabel(),
  );

  public currentBuff = computed(() => {
    const shrine = this.shrine();
    if (!shrine) return undefined;

    const tier = worldNodeShrineCurrentTier(shrine, this.entry().nodeName);
    if (!tier) return undefined;

    return getEntry<GlobalEffectContent>(tier.globalEffectId);
  });

  doPray() {
    this.pray.emit();
  }
}
