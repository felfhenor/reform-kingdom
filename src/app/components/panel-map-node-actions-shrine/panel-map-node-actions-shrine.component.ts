import { FFButtonComponent } from '@ff/components/button/button.component';
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
import { getEntry } from '@helpers/content/content';
import { formatDuration } from '@helpers/engine/timer';
import { globalEffectEffectsScaled } from '@helpers/hero/global-effect-state';
import { isPartyAtNode } from '@helpers/world';
import {
  shrinePrayerCooldownRemaining,
  worldNodeShrineCurrentTier,
} from '@helpers/world-node/world-node-shrine';
import { shrineBuffStrength } from '@helpers/world-node/world-node-shrine.ui';
import { worldNodeShrine } from '@helpers/world-node/world-nodes';
import type { GlobalEffectContent, WorldNodeEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-map-node-actions-shrine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FFButtonComponent,
    AtlasImageComponent,
    ButtonWorldNodeDevelopComponent,
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

    const content = getEntry<GlobalEffectContent>(tier.globalEffectId);
    if (!content) return undefined;

    const strength = shrineBuffStrength();
    return {
      ...content,
      effects: globalEffectEffectsScaled(content.effects, strength),
    };
  });

  doPray() {
    this.pray.emit();
  }
}
