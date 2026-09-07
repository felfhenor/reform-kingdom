import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { ButtonCloseComponent } from '@components/button-close/button-close.component';
import { PanelMapNodeActionsCaravanComponent } from '@components/panel-map-node-actions-caravan/panel-map-node-actions-caravan.component';
import { PanelMapNodeActionsExploreComponent } from '@components/panel-map-node-actions-explore/panel-map-node-actions-explore.component';
import { PanelMapNodeActionsGatherComponent } from '@components/panel-map-node-actions-gather/panel-map-node-actions-gather.component';
import { PanelMapNodeActionsTownComponent } from '@components/panel-map-node-actions-town/panel-map-node-actions-town.component';
import { PanelMapNodeBadgesCaravanComponent } from '@components/panel-map-node-badges-caravan/panel-map-node-badges-caravan.component';
import { PanelMapNodeBadgesExploreComponent } from '@components/panel-map-node-badges-explore/panel-map-node-badges-explore.component';
import { PanelMapNodeBadgesGatherComponent } from '@components/panel-map-node-badges-gather/panel-map-node-badges-gather.component';
import { PanelMapNodeBadgesTownComponent } from '@components/panel-map-node-badges-town/panel-map-node-badges-town.component';
import { PanelMapNodeStatusEncounterComponent } from '@components/panel-map-node-status-encounter/panel-map-node-status-encounter.component';
import { PanelMapNodeStatusGatherComponent } from '@components/panel-map-node-status-gather/panel-map-node-status-gather.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotGatherMaterialComponent } from '@components/slot-gather-material/slot-gather-material.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { SFXDirective } from '@directives/sfx.directive';
import { caravanBrandName } from '@helpers/caravan/caravan';
import { encounterStartFight } from '@helpers/encounter/encounter';
import { encounterRandomStartFight } from '@helpers/encounter/encounter-random-combat';
import {
  caravanTradeOpen,
  mapNodeDeselect,
  selectedMapNode,
  townOpen,
} from '@helpers/engine/ui';

import {
  canPartyTravel,
  travelStart,
  travelStepTicksCost,
} from '@helpers/hero/travel';
import {
  canEnterGatherNode,
  gatheringProgressFraction,
} from '@helpers/item/gathering';
import { rewardDisplayOrder } from '@helpers/item/loot';
import { travelPathTo } from '@helpers/pathfinding/pathfinding-travel';
import { gamestate } from '@helpers/state-game';
import { townReputationDisplay } from '@helpers/town/reputation/town-reputation.ui';
import { currentLocationGet } from '@helpers/world';
import { worldNodeCaravanIsAvailable } from '@helpers/world-node/world-node-caravan.ui';
import { worldNodeDescription } from '@helpers/world-node/world-node-content.ui';
import { worldNodeExploreRandomIsAvailable } from '@helpers/world-node/world-node-encounter';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import { gatherNodeLevelUp } from '@helpers/world-node/world-node-level.ui';
import { worldNodeCompletionRewards } from '@helpers/world-node/world-node-rewards';
import {
  worldNodeLevelLabel,
  worldNodeLevelRange,
} from '@helpers/world-node/world-node-status';
import {
  worldNodeCaravan,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import { sortBy, sum } from 'es-toolkit/compat';

@Component({
  selector: 'app-panel-map-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonCloseComponent,
    SlotCompletionRewardComponent,
    SlotGatherMaterialComponent,
    PanelMapNodeActionsCaravanComponent,
    PanelMapNodeActionsExploreComponent,
    PanelMapNodeActionsGatherComponent,
    PanelMapNodeActionsTownComponent,
    PanelMapNodeBadgesCaravanComponent,
    PanelMapNodeBadgesExploreComponent,
    PanelMapNodeBadgesGatherComponent,
    PanelMapNodeBadgesTownComponent,
    PanelMapNodeStatusEncounterComponent,
    PanelMapNodeStatusGatherComponent,
    SpriteNodeComponent,
    SFXDirective,
    BarProgressComponent,
  ],
  templateUrl: './panel-map-node.component.html',
  styleUrl: './panel-map-node.component.scss',
})
export class PanelMapNodeComponent {
  public node = computed(() => selectedMapNode());

  public gatherNodeLevel = computed(() => {
    const entry = this.node();
    return entry && this.isGatherNode() ? worldNodeLevel(entry.nodeName) : 0;
  });

  public displayName = computed(() => {
    const entry = this.node();
    if (!entry) return '';

    if (this.isCaravanNode()) return caravanBrandName(entry.nodeName);
    if (this.isTownNode()) return worldNodeTown(entry)?.name ?? entry.nodeName;

    const level = this.gatherNodeLevel();
    return level > 0 ? `${entry.nodeName} +${level}` : entry.nodeName;
  });

  public levelLabel = computed(() => {
    const entry = this.node();
    const levelRange = entry ? worldNodeLevelRange(entry) : undefined;
    return levelRange ? worldNodeLevelLabel(levelRange) : '-';
  });

  public description = computed(() => {
    const entry = this.node();
    return entry ? worldNodeDescription(entry) : undefined;
  });

  public gatherMaterialIds = computed(() => {
    const entry = this.node();
    return entry ? worldNodeGatherMaterialIds(entry) : [];
  });

  public completionRewards = computed(() => {
    const entry = this.node();
    if (!entry) return [];

    return sortBy(worldNodeCompletionRewards(entry), [rewardDisplayOrder]);
  });

  public meetsGatherLevelRequirement = computed(() => {
    const entry = this.node();
    return !entry || canEnterGatherNode(entry.nodeName);
  });

  public isCaravanNode = computed(() => {
    const entry = this.node();
    return !!entry && !!worldNodeCaravan(entry);
  });

  public isGatherNode = computed(() => {
    const entry = this.node();
    return !!entry && !!worldNodeGathering(entry);
  });

  public isExploreNode = computed(() => {
    const entry = this.node();
    return (
      !!entry &&
      (!!worldNodeEncounter(entry) || !!worldNodeEncounterRandom(entry))
    );
  });

  public isTownNode = computed(() => {
    const entry = this.node();
    return !!entry && !!worldNodeTown(entry);
  });

  public townReputation = computed(() => {
    const entry = this.node();
    const town = entry ? worldNodeTown(entry) : undefined;
    return town ? townReputationDisplay(town.id) : undefined;
  });

  public meetsCaravanAvailability = computed(() => {
    const entry = this.node();
    if (!entry || !worldNodeCaravan(entry)) return true;

    return worldNodeCaravanIsAvailable(entry);
  });

  public isGatheringHere = computed(() => {
    const entry = this.node();
    const gathering = gamestate().world.gathering;
    return (
      !!entry &&
      gathering.status === 'Gathering' &&
      gathering.nodeName === entry.nodeName
    );
  });

  public gatherProgressPercent = computed(() =>
    Math.round(gatheringProgressFraction() * 100),
  );

  private travelPath = computed(() => {
    const entry = this.node();
    return entry ? travelPathTo(entry.nodeName) : undefined;
  });

  public travelSeconds = computed(() => {
    const path = this.travelPath();
    if (!path) return undefined;

    let origin = currentLocationGet();
    const costs = path.map((step) => {
      const cost = travelStepTicksCost(step, origin);
      origin = step;
      return cost;
    });

    return sum(costs);
  });

  private travelState = computed(() => gamestate().world.travel);

  public isAtNode = computed(
    () =>
      this.travelPath()?.length === 0 && this.travelState().status === 'Idle',
  );

  private isInCombat = computed(() => !!gamestate().world.combat);

  public canReExplore = computed(() => {
    const entry = this.node();
    if (!entry || !this.isAtNode() || this.isInCombat()) return false;

    if (worldNodeEncounter(entry)) return true;

    return (
      !!worldNodeEncounterRandom(entry) &&
      worldNodeExploreRandomIsAvailable(entry)
    );
  });

  public canTravelHere = computed(() => {
    const entry = this.node();
    const path = this.travelPath();
    const travel = this.travelState();
    const isCurrentDestination =
      travel.status === 'Traveling' &&
      travel.destinationNodeName === entry?.nodeName;

    return (
      !!path &&
      (path.length > 0 || travel.status === 'Traveling') &&
      !isCurrentDestination &&
      canPartyTravel() &&
      this.meetsGatherLevelRequirement() &&
      this.meetsCaravanAvailability()
    );
  });

  public travel(): void {
    const entry = this.node();
    if (!entry) return;

    if (travelStart(entry.nodeName)) {
      this.close();
    }
  }

  public reExplore(): void {
    const entry = this.node();
    if (!entry) return;

    const encounter = worldNodeEncounter(entry);
    if (encounter) {
      encounterStartFight(encounter.id, 0, entry.nodeName);
      return;
    }

    if (worldNodeEncounterRandom(entry)) {
      encounterRandomStartFight(entry, 0);
    }
  }

  public openTrade(): void {
    const entry = this.node();
    if (!entry) return;

    caravanTradeOpen(entry);
  }

  public openTown(): void {
    const entry = this.node();
    if (!entry) return;

    townOpen(entry);
  }

  public develop(): void {
    const entry = this.node();
    if (!entry) return;

    gatherNodeLevelUp(entry.nodeName);
  }

  public close(): void {
    mapNodeDeselect();
  }
}
