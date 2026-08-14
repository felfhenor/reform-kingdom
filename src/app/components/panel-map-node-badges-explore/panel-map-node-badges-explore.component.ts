import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { TippyDirective } from '@ngneat/helipopper';
import { isMonsterDiscovered } from '@helpers/bestiary';
import {
  worldNodeEncounterCount,
  worldNodeMonsterCount,
  worldNodeMonsters,
} from '@helpers/world-node-encounter';
import { worldNodeCompletionRewardProgress } from '@helpers/world-node-rewards';
import type { WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-panel-map-node-badges-explore',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasAnimationComponent, IconUnknownComponent, TippyDirective],
  templateUrl: './panel-map-node-badges-explore.component.html',
  styleUrl: './panel-map-node-badges-explore.component.scss',
})
export class PanelMapNodeBadgesExploreComponent {
  public entry = input.required<WorldNodeEntry>();

  public isMonsterDiscovered = isMonsterDiscovered;

  public encounterCount = computed(() => worldNodeEncounterCount(this.entry()));

  public monsterCount = computed(() => worldNodeMonsterCount(this.entry()));

  public monsters = computed(() => worldNodeMonsters(this.entry()));

  public rewardProgress = computed(() =>
    worldNodeCompletionRewardProgress(this.entry()),
  );
}
