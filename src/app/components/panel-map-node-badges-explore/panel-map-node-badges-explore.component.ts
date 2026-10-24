import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DetailMonsterSummaryComponent } from '@components/detail-monster-summary/detail-monster-summary.component';
import { bestiaryEntry } from '@helpers/kingdom/bestiary.ui';
import { worldNodeEncounterCount } from '@helpers/world-node/world-node-encounter';
import {
  worldNodeMonsterCount,
  worldNodeMonsters,
} from '@helpers/world-node/world-node-encounter.ui';
import { worldNodeCompletionRewardProgress } from '@helpers/world-node/world-node-rewards';
import type { WorldNodeEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-map-node-badges-explore',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailMonsterSummaryComponent, TippyDirective],
  templateUrl: './panel-map-node-badges-explore.component.html',
  styleUrl: './panel-map-node-badges-explore.component.scss',
})
export class PanelMapNodeBadgesExploreComponent {
  public entry = input.required<WorldNodeEntry>();

  public encounterCount = computed(() => worldNodeEncounterCount(this.entry()));

  public monsterCount = computed(() => worldNodeMonsterCount(this.entry()));

  public monsterEntries = computed(() =>
    worldNodeMonsters(this.entry()).map(bestiaryEntry),
  );

  public rewardProgress = computed(() =>
    worldNodeCompletionRewardProgress(this.entry()),
  );
}
