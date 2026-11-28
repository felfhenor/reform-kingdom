import { TPipe } from '@pipes/t.pipe';
import { durationText } from '@helpers/engine/timer.ui';
import { ContentNamePipe } from '@pipes/content-name.pipe';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DetailMonsterSummaryComponent } from '@components/detail-monster-summary/detail-monster-summary.component';
import { regionIsSealed, regionSealTime } from '@helpers/combat/combat-manual';
import { bestiaryEntry } from '@helpers/kingdom/bestiary.ui';
import { regionSealedBy } from '@helpers/lore/region-intro';
import { worldNodeEncounterCount } from '@helpers/world-node/world-node-encounter';
import {
  worldNodeMonsterCount,
  worldNodeMonsters,
} from '@helpers/world-node/world-node-encounter.ui';
import { worldNodeCompletionRewardProgress } from '@helpers/world-node/world-node-rewards';
import { worldNodeEncounter } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-map-node-badges-explore',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    ContentNamePipe,
    DetailMonsterSummaryComponent,
    TippyDirective,
  ],
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

  public sealRegion = computed(() => {
    const encounterId = worldNodeEncounter(this.entry())?.id;
    return encounterId ? regionSealedBy(encounterId) : undefined;
  });

  public isSealed = computed(() => {
    const region = this.sealRegion();
    return !!region && regionIsSealed(region.mapName);
  });

  public sealTicksTime(): string {
    const region = this.sealRegion();
    if (!region) return '';

    return durationText(regionSealTime(region.mapName));
  }
}
