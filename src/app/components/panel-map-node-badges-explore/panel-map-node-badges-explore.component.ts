import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { TippyDirective } from '@ngneat/helipopper';
import {
  isMonsterDiscovered,
  worldNodeCompletionRewardProgress,
  worldNodeEncounterCount,
  worldNodeMonsterCount,
  worldNodeMonsters,
} from '@helpers';
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
