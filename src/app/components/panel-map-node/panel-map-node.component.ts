import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ButtonCloseComponent } from '@components/button-close/button-close.component';
import { PanelMapNodeActionsCaravanComponent } from '@components/panel-map-node-actions-caravan/panel-map-node-actions-caravan.component';
import { PanelMapNodeActionsExploreComponent } from '@components/panel-map-node-actions-explore/panel-map-node-actions-explore.component';
import { PanelMapNodeActionsGatherComponent } from '@components/panel-map-node-actions-gather/panel-map-node-actions-gather.component';
import { PanelMapNodeBadgesCaravanComponent } from '@components/panel-map-node-badges-caravan/panel-map-node-badges-caravan.component';
import { PanelMapNodeBadgesExploreComponent } from '@components/panel-map-node-badges-explore/panel-map-node-badges-explore.component';
import { PanelMapNodeBadgesGatherComponent } from '@components/panel-map-node-badges-gather/panel-map-node-badges-gather.component';
import { SlotCompletionRewardComponent } from '@components/slot-completion-reward/slot-completion-reward.component';
import { SlotGatherMaterialComponent } from '@components/slot-gather-material/slot-gather-material.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { SFXDirective } from '@directives/sfx.directive';
import { caravanBrandName } from '@helpers/caravan';
import { encounterStartFight } from '@helpers/encounter';
import { encounterRandomStartFight } from '@helpers/encounter-random-combat';
import {
  canEnterGatherNode,
  gatheringProgressFraction,
} from '@helpers/gathering';
import { rewardDisplayOrder } from '@helpers/loot';
import { travelPathTo } from '@helpers/pathfinding';
import { gamestate } from '@helpers/state-game';
import {
  canPartyTravel,
  travelStart,
  travelStepTicksCost,
} from '@helpers/travel';
import {
  caravanTradeOpen,
  mapNodeDeselect,
  selectedMapNode,
} from '@helpers/ui';
import { currentLocationGet } from '@helpers/world';
import { worldNodeCaravanIsAvailable } from '@helpers/world-node-caravan';
import { worldNodeDescription } from '@helpers/world-node-content';
import { worldNodeExploreRandomIsAvailable } from '@helpers/world-node-encounter';
import { worldNodeGatherMaterialIds } from '@helpers/world-node-gathering';
import { worldNodeCompletionRewards } from '@helpers/world-node-rewards';
import {
  worldNodeLevelLabel,
  worldNodeLevelRange,
} from '@helpers/world-node-status';
import {
  worldNodeCaravan,
  worldNodeEncounter,
  worldNodeEncounterRandom,
  worldNodeGathering,
} from '@helpers/world-nodes';
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
    PanelMapNodeBadgesCaravanComponent,
    PanelMapNodeBadgesExploreComponent,
    PanelMapNodeBadgesGatherComponent,
    SpriteNodeComponent,
    SFXDirective,
  ],
  templateUrl: './panel-map-node.component.html',
  styleUrl: './panel-map-node.component.scss',
})
export class PanelMapNodeComponent {
  public node = computed(() => selectedMapNode());

  public displayName = computed(() => {
    const entry = this.node();
    if (!entry) return '';

    return this.isCaravanNode()
      ? caravanBrandName(entry.nodeName)
      : entry.nodeName;
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

  public close(): void {
    mapNodeDeselect();
  }
}
